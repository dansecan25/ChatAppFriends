interface PasswordCredentialConstructor {
  new (data: { id: string; password: string }): Credential;
}

/**
 * Offers to save a login after it succeeds. This app signs in without loading a new page, so browsers may not notice
 * by themselves. Browsers without this API, such as Firefox, rely on the form's autocomplete fields instead.
 */
export async function offerToSaveLogin(username: string, password: string): Promise<void> {
  const PasswordCredential = (window as unknown as { PasswordCredential?: PasswordCredentialConstructor }).PasswordCredential;
  if (!PasswordCredential || !navigator.credentials) return;
  await navigator.credentials.store(new PasswordCredential({ id: username, password })).catch(() => undefined);
}
