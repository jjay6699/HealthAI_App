import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "./theme";
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

const App = () => {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/register" element={<RegisterScreen />} />
        </Route>
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
        </Route>
        <Route path="/intake" element={<ProfileIntakeScreen />} />
        <Route path="/questionnaire" element={<QuestionnaireScreen />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </ThemeProvider>
  );
};

export default App;
