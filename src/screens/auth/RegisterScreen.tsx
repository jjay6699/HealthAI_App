import React, { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../components/Button";
import { useI18n } from "../../i18n";
import { AppTheme, useTheme } from "../../theme";

const RegisterScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", country: "" });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const updateField = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!agreeTerms) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate("/intake");
    }, 800);
  };

  return (
    <div style={styles.wrapper}>
      <h1 style={styles.heading}>{t("auth.register.heading")}</h1>
      <p style={styles.subheading}>{t("auth.register.subheading")}</p>

      <form style={styles.form} onSubmit={handleSubmit}>
        <label style={styles.label} htmlFor="name">
          {t("auth.register.name")}
        </label>
        <input
          id="name"
          placeholder="Jane Doe"
          value={form.name}
          onChange={updateField("name")}
          style={styles.input}
        />

        <label style={styles.label} htmlFor="register-email">
          Email
        </label>
        <input
          id="register-email"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={updateField("email")}
          style={styles.input}
        />

        <label style={styles.label} htmlFor="register-password">
          {t("auth.login.password")}
        </label>
        <input
          id="register-password"
          type="password"
          placeholder="********"
          value={form.password}
          onChange={updateField("password")}
          style={styles.input}
        />
        <span style={styles.helper}>{t("auth.register.helper")}</span>

        <label style={styles.label} htmlFor="register-country">
          {t("auth.register.country")}
        </label>
        <input
          id="register-country"
          placeholder="United States"
          value={form.country}
          onChange={updateField("country")}
          style={styles.input}
        />

        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={(event) => setAgreeTerms(event.target.checked)}
            style={styles.checkbox}
          />
          <span style={styles.checkboxLabel}>{t("auth.register.agree")}</span>
        </label>

        <Button title={t("auth.register.next")} type="submit" fullWidth disabled={!agreeTerms} loading={loading} />
      </form>

      <div style={styles.footerRow}>
        <span style={styles.footerText}>{t("auth.register.haveAccount")}</span>
        <Link to="/login" style={styles.link}>
          {t("auth.login.submit")}
        </Link>
      </div>
    </div>
  );
};

const createStyles = (theme: AppTheme) => ({
  wrapper: {
    display: "flex",
    flexDirection: "column" as const,
    padding: `${theme.spacing.xxl}px ${theme.spacing.xl}px`
  },
  heading: {
    ...theme.typography.displayMd,
    marginBottom: theme.spacing.xs
  },
  subheading: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl
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
  helper: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: -theme.spacing.sm + 2,
    marginBottom: theme.spacing.sm
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
    cursor: "pointer"
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    border: `1px solid ${theme.colors.background}`
  },
  checkboxLabel: {
    fontSize: 14,
    color: theme.colors.text
  },
  footerRow: {
    display: "flex",
    justifyContent: "center",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xl
  },
  footerText: {
    color: theme.colors.textSecondary,
    fontSize: 14
  },
  link: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: 600
  }
});

export default RegisterScreen;
