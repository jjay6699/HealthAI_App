import React, { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../components/Button";
import { AppTheme, useTheme } from "../../theme";

const demoCredentials = {
  email: "demo@newgene.app",
  password: "DemoPass!1"
};

const LoginScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();
  const [email, setEmail] = useState(""
);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      navigate("/home");
    }, 600);
  };

  const handleUseDemo = () => {
    setEmail(demoCredentials.email);
    setPassword(demoCredentials.password);
  };

  return (
    <div style={styles.wrapper}>
      <h1 style={styles.heading}>Welcome back</h1>
      <p style={styles.subheading}>Log in to continue your personalized insights.</p>
      <div style={styles.demoBox}>
        <div>
          <p style={styles.demoTitle}>Demo access</p>
          <p style={styles.demoCopy}>
            Email: <strong>{demoCredentials.email}</strong>
            <br />Password: <strong>{demoCredentials.password}</strong>
          </p>
        </div>
        <Button title="Fill details" variant="secondary" onClick={handleUseDemo} style={{ alignSelf: "flex-start" }} />
      </div>
      <form style={styles.form} onSubmit={handleSubmit}>
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
          Password
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
            Forgot password?
          </button>
        </div>

        <Button title="Login" type="submit" fullWidth loading={isLoading} style={{ marginTop: theme.spacing.sm }} />
      </form>

      <div style={styles.dividerRow}>
        <span style={styles.divider} />
        <span style={styles.dividerLabel}>or continue with</span>
        <span style={styles.divider} />
      </div>

      <div style={styles.socialRow}>
        <button type="button" style={styles.socialButton}>
          Google
        </button>
      </div>

      <div style={styles.footerRow}>
        <span style={styles.footerText}>New here?</span>
        <Link to="/register" style={styles.link}>
          Create an account
        </Link>
      </div>

      <p style={styles.legal}>By logging in you agree to our Terms of Service and Privacy Policy.</p>
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
  linkButton: {
    border: "none",
    background: "transparent",
    color: theme.colors.info,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer"
  },
  dividerRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.divider
  },
  dividerLabel: {
    textTransform: "uppercase" as const,
    fontSize: 12,
    color: theme.colors.textSecondary,
    letterSpacing: 1
  },
  socialRow: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: theme.spacing.md
  },
  socialButton: {
    borderRadius: theme.radii.md,
    border: "1px solid #E5E7EB",
    background: "#FFFFFF",
    padding: `${theme.spacing.lg}px`,
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    outline: "none"
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
