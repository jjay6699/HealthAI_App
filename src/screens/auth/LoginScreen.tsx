import React, { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../components/Button";
import { useI18n } from "../../i18n";
import { useAuth } from "../../services/auth";
import { persistentStorage } from "../../services/persistentStorage";
import { AppTheme, useTheme } from "../../theme";

const demoCredentials = {
  email: "demo@newgene.app",
  password: "DemoPass!1"
};

const LoginScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const [email, setEmail] = useState(""
);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (payload?.error === "invalid_credentials") {
          throw new Error("Incorrect email or password.");
        }
        if (payload?.error === "too_many_attempts") {
          throw new Error("Too many login attempts. Please wait and try again.");
        }
        if (payload?.error === "invalid_login_payload") {
          throw new Error("Please enter a valid email and password.");
        }
        throw new Error("Unable to log in right now.");
      }

      if (email.trim().toLowerCase() === demoCredentials.email) {
        persistentStorage.setJSON("userConsents", {
          termsPrivacyAccepted: true,
          healthDataProcessingAccepted: true,
          researchParticipation: false,
          marketingCommunication: false,
          policyVersion: "2026-03",
          acceptedAt: new Date().toISOString()
        });
      }

      await refreshAuth();
      setIsLoading(false);
      navigate("/home");
    } catch (err) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : "Unable to log in right now.");
    }
  };

  const handleUseDemo = () => {
    setEmail(demoCredentials.email);
    setPassword(demoCredentials.password);
  };

  return (
    <div style={styles.wrapper}>
      <h1 style={styles.heading}>{t("auth.login.heading")}</h1>
      <p style={styles.subheading}>{t("auth.login.subheading")}</p>
      <div style={styles.demoBox}>
        <div>
          <p style={styles.demoTitle}>{t("auth.login.demoTitle")}</p>
          <p style={styles.demoCopy}>
            Email: <strong>{demoCredentials.email}</strong>
            <br />Password: <strong>{demoCredentials.password}</strong>
          </p>
        </div>
        <Button title={t("auth.login.fillDetails")} variant="secondary" onClick={handleUseDemo} style={{ alignSelf: "flex-start" }} />
      </div>
      <form style={styles.form} onSubmit={handleSubmit}>
        {error ? <p style={styles.error}>{error}</p> : null}
        <label style={styles.label} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          style={styles.input}
        />

        <label style={styles.label} htmlFor="password">
          {t("auth.login.password")}
        </label>
        <input
          id="password"
          type="password"
          required
          placeholder="********"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          style={styles.input}
        />

        <div style={styles.forgotRow}>
          <button type="button" style={styles.linkButton}>
            {t("auth.login.forgot")}
          </button>
        </div>

        <Button title={t("auth.login.submit")} type="submit" fullWidth loading={isLoading} style={{ marginTop: theme.spacing.sm }} />
      </form>

      <div style={styles.footerRow}>
        <span style={styles.footerText}>{t("auth.login.newHere")}</span>
        <Link to="/register" style={styles.link}>
          {t("auth.login.createAccount")}
        </Link>
      </div>

      <p style={styles.legal}>{t("auth.login.legal")}</p>
    </div>
  );
};

const createStyles = (theme: AppTheme) => ({
  wrapper: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md,
    padding: `${theme.spacing.xxl}px ${theme.spacing.xl}px`
  },
  heading: {
    ...theme.typography.displayMd,
    marginBottom: theme.spacing.xs
  },
  subheading: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md
  },
  demoBox: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    borderRadius: theme.radii.lg,
    background: "rgba(59, 130, 246, 0.08)",
    border: `1px solid rgba(59, 130, 246, 0.2)`
  },
  demoTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: theme.colors.info,
    margin: 0
  },
  demoCopy: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    margin: 0,
    lineHeight: "20px"
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: theme.colors.text
  },
  input: {
    width: "100%",
    borderRadius: theme.radii.md,
    border: "1px solid #FFFFFF",
    backgroundColor: "#FFFFFF",
    padding: `${theme.spacing.lg}px ${theme.spacing.lg}px`,
    fontSize: 16,
    color: theme.colors.text,
    outline: "none"
  },
  forgotRow: {
    display: "flex",
    justifyContent: "flex-end"
  },
  error: {
    margin: 0,
    color: theme.colors.error,
    fontSize: 14
  },
  linkButton: {
    border: "none",
    background: "transparent",
    color: theme.colors.info,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer"
  },
  footerRow: {
    marginTop: theme.spacing.xl,
    display: "flex",
    justifyContent: "center",
    gap: theme.spacing.xs
  },
  footerText: {
    color: theme.colors.textSecondary,
    fontSize: 14
  },
  link: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: 600
  },
  legal: {
    marginTop: theme.spacing.xl,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: "center" as const
  }
});

export default LoginScreen;
