/**
 * Contrato de testIDs entre la app PROP+ y los tests.
 * En Android, `testID` de React Native se convierte en `resource-id`.
 * Se busca con:  $(byId(S.signIn.email))
 */

/** Selector nativo Android por resource-id (lo que genera `testID` en RN). */
export const byId = (resourceId: string) =>
  `android=new UiSelector().resourceId("${resourceId}")`;

export const S = {
  signIn: {
    email: 'signin-email',
    password: 'signin-password',
    submit: 'signin-submit',
  },
  signUp: {
    firstName: 'signup-firstName',
    lastName: 'signup-lastName',
    email: 'signup-email',
    phone: 'signup-phone',
    password: 'signup-password',
    confirmPassword: 'signup-confirmPassword',
    submit: 'signup-submit',
  },
  settings: {
    firstName: 'settings-firstName',
    lastName: 'settings-lastName',
    email: 'settings-email',
    phone: 'settings-phone',
    save: 'settings-save',
  },
} as const;

export const demoUser = {
  email: 'demo@propplus.com',
  password: 'Demo1234',
};

/** Helpers de localización por texto visible (para elementos sin testID). */
export const byText = (text: string) => `//*[@text="${text}"]`;
export const byTextContains = (text: string) =>
  `//*[contains(@text, "${text}")]`;
