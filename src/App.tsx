import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "./theme";
import ScrollToTop from "./components/ScrollToTop";
import DesktopPrompt from "./components/DesktopPrompt";
import { RedirectIfAuthed, RequireAuth } from "./components/AuthGuards";
import useMediaQuery from "./hooks/useMediaQuery";
import AppLayout from "./layout/AppLayout";
import AuthLayout from "./layout/AuthLayout";
import HomeScreen from "./screens/home/HomeScreen";
import UploadScreen from "./screens/upload/UploadScreen";
import InsightsScreen from "./screens/insights/InsightsScreen";
import SupplementsScreen from "./screens/supplements/SupplementsScreen";
import ProfileScreen from "./screens/profile/ProfileScreen";
import HistoryScreen from "./screens/history/HistoryScreen";
import LoginScreen from "./screens/auth/LoginScreen";
import RegisterScreen from "./screens/auth/RegisterScreen";
import ProfileIntakeScreen from "./screens/onboarding/ProfileIntakeScreen";
import QuestionnaireScreen from "./screens/questionnaire/QuestionnaireScreen";
import SplashScreen from "./screens/common/SplashScreen";
import OrderReviewScreen from "./screens/order/OrderReviewScreen";
import CheckoutScreen from "./screens/order/CheckoutScreen";
import PaymentScreen from "./screens/order/PaymentScreen";
import OrderConfirmationScreen from "./screens/order/OrderConfirmationScreen";
import OrdersScreen from "./screens/order/OrdersScreen";
import { I18nProvider } from "./i18n";
import { AuthProvider } from "./services/auth";

const App = () => {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          {isDesktop && <DesktopPrompt />}
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<SplashScreen />} />
            <Route element={<RedirectIfAuthed />}>
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<LoginScreen />} />
                <Route path="/register" element={<RegisterScreen />} />
              </Route>
            </Route>
            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route path="/home" element={<HomeScreen />} />
                <Route path="/upload" element={<UploadScreen />} />
                <Route path="/insights" element={<InsightsScreen />} />
                <Route path="/supplements" element={<SupplementsScreen />} />
                <Route path="/profile" element={<ProfileScreen />} />
                <Route path="/history" element={<HistoryScreen />} />
                <Route path="/order-review" element={<OrderReviewScreen />} />
                <Route path="/checkout" element={<CheckoutScreen />} />
                <Route path="/payment" element={<PaymentScreen />} />
                <Route path="/order-confirmation" element={<OrderConfirmationScreen />} />
                <Route path="/orders" element={<OrdersScreen />} />
              </Route>
              <Route path="/intake" element={<ProfileIntakeScreen />} />
              <Route path="/questionnaire" element={<QuestionnaireScreen />} />
            </Route>
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
};

export default App;
