import { model, Schema } from 'mongoose';

export interface OAuthGuild {
  id: string;
  owner: boolean;
  permissions: string;
}

export interface AuthSession {
  tokenHash: string;
  userId: string;
  username: string;
  avatar: string | null;
  csrfToken: string;
  oauthGuilds: OAuthGuild[];
  expiresAt: Date;
}

const AuthSessionSchema = new Schema<AuthSession>({
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  avatar: { type: String, default: null },
  csrfToken: { type: String, required: true },
  oauthGuilds: [{
    id: { type: String, required: true },
    owner: { type: Boolean, required: true },
    permissions: { type: String, required: true }
  }],
  expiresAt: { type: Date, required: true, expires: 0 }
});

export const AuthSessionModel = model<AuthSession>('AuthSession', AuthSessionSchema);
