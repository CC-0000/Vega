import React, { useState, useCallback } from "react";
import axios from "axios";
import * as forge from "node-forge";
import "./styles.css";
import { useAuth } from "../../context/AuthContext.defs";
import googleIcon from "../../assets/react.svg";

interface AuthState {
  isLoading: boolean;
  error: string;
  step: "login" | "certificate" | "complete";
  privateKey: string | null;
  csrBase64: string | null;
  certificate: string | null;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authState, setAuthState] = useState<AuthState>({
    isLoading: false,
    error: "",
    step: "login",
    privateKey: null,
    csrBase64: null,
    certificate: null,
  });
  const { login } = useAuth();

  // Generate RSA key pair and proper X.509 CSR using node-forge
  const generateKeyPairAndCSR = useCallback(
    async (
      userId: string
    ): Promise<{ privateKey: string; csrBase64: string }> => {
      try {
        // Generate a new RSA key pair with 2048 bits
        const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048 });

        // Create a certification request (CSR)
        const csr = forge.pki.createCertificationRequest();

        // Set the subject of the certificate
        csr.subject.addField({ name: "commonName", value: userId });
        csr.subject.addField({ name: "organizationName", value: "Indeq LLC" });

        // Set the public key
        csr.publicKey = keypair.publicKey;

        // Sign the certification request with the private key
        csr.sign(keypair.privateKey, forge.md.sha256.create());

        // Convert the CSR to PEM format
        const csrPem = forge.pki.certificationRequestToPem(csr);

        // Convert the private key to PEM format
        const privateKeyPem = forge.pki.privateKeyToPem(keypair.privateKey);

        // Verify the CSR was properly created
        const verified = csr.verify();
        if (!verified) {
          throw new Error("Failed to verify CSR signature");
        }

        const pemHeader = "-----BEGIN CERTIFICATE REQUEST-----";
        const pemFooter = "-----END CERTIFICATE REQUEST-----";
        const csrBase64 = csrPem
          .replace(pemHeader, "")
          .replace(pemFooter, "")
          .replace(/\s/g, "");

        return {
          privateKey: privateKeyPem,
          csrBase64,
        };
      } catch (err) {
        // Log error but don't expose details to console in production
        throw new Error(
          `Failed to generate security credentials: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    },
    []
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Simple validation
    if (!email.trim() || !password.trim()) {
      setAuthState((prev) => ({
        ...prev,
        error: "Please enter both email and password",
      }));
      return;
    }

    try {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: "" }));

      // Step 2: Send login request to server
      const loginResponse = await axios.post(
        `http://localhost:8080/api/login`, // TODO: change to env variables
        {
          email,
          password,
        }
      );

      // Check for error in login response
      if (loginResponse.data.error) {
        throw new Error(loginResponse.data.error);
      }

      // Handle successful login
      const userId = loginResponse.data.user_id;

      // Step 2: Generate RSA key pair and CSR
      const { privateKey, csrBase64 } = await generateKeyPairAndCSR(userId);

      // Step 3: Send CSR to server
      const csrResponse = await axios.post(
        `http://localhost:8080/api/csr`, // TODO: change to env variables
        {
          email,
          password,
          csr_base64: csrBase64,
        }
      );

      const certificateBase64 = csrResponse.data.certificate_base64;

      // Step 4: Store userId, certificate, and privateKey securely
      await login(userId, certificateBase64, privateKey);

      // Step 5: Complete authentication
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        step: "complete",
      }));
    } catch (err) {
      // Log error and update state
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          err instanceof Error
            ? err.message
            : "Authentication failed. Please check your credentials.",
      }));
    }
  }

  const handleGoogleLogin = () => {
    // Empty function for Google login as requested
    console.log("Google login clicked");
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="card-header">
          <h2 className="card-title">Welcome back</h2>
          <p className="card-description">
            Enter your email below to login to your account
          </p>
        </div>

        <div className="card-content">
          <button
            type="button"
            className="google-login-button"
            onClick={handleGoogleLogin}
          >
            <span className="google-icon-wrapper">
              <img
                src={googleIcon}
                className="google-icon"
                width="18"
                height="18"
                alt="Google"
              />
            </span>
            Login with Google
          </button>

          <div className="divider">
            <span className="divider-text">Or continue with</span>
          </div>

          {authState.error && (
            <div className="error-message">{authState.error}</div>
          )}

          {authState.step === "login" && (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="login-email">Email</label>
                <input
                  type="email"
                  id="login-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="m@example.com"
                  disabled={authState.isLoading}
                  className="input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="login-password">Password</label>
                <input
                  type="password"
                  id="login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder=""
                  disabled={authState.isLoading}
                  className="input"
                />
              </div>
              <button
                type="submit"
                className="login-button"
                disabled={authState.isLoading}
              >
                {authState.isLoading ? "Logging in..." : "Login"}
              </button>

              <div className="signup-link">
                <p>
                  Don&apos;t have an account?{" "}
                  <a href="#signup" className="link">
                    Sign up
                  </a>
                </p>
              </div>
            </form>
          )}

          {authState.step === "complete" && (
            <div className="login-success">
              <p>Login successful! Redirecting...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;
