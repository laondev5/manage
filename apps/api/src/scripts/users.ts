import type { Auth } from '../auth.js';
import type { Collections } from '@manage/database';

export type SeededUser = { id: string; email: string; created: boolean };

export async function ensureAuthUser(
  auth: Auth,
  c: Collections,
  input: { name: string; email: string; password: string },
): Promise<SeededUser> {
  const existing = await c.users.findOne({ email: input.email });
  if (existing) {
    const id = typeof existing._id === 'string' ? existing._id : existing._id.toHexString();
    return { id, email: input.email, created: false };
  }

  const result = await auth.api.signUpEmail({
    body: { name: input.name, email: input.email, password: input.password },
  });
  const id = result.user.id;

  await c.users.updateOne(
    { email: input.email },
    { $set: { emailVerified: true, updatedAt: new Date() } },
  );

  return { id, email: input.email, created: true };
}
