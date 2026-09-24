export const AUTH_CAPTCHA_RESPONSE_HEADER = "x-captcha-response";

export const AUTH_CAPTCHA_ACTIONS = {
  login: "login",
  register: "register",
  resendRegistration: "resend_registration",
  forgotPassword: "forgot_password",
} as const;

export type AuthCaptchaAction =
  (typeof AUTH_CAPTCHA_ACTIONS)[keyof typeof AUTH_CAPTCHA_ACTIONS];
