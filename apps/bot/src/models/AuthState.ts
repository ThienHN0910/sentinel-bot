import { model, Schema } from 'mongoose';

export interface AuthState {
  stateHash: string;
  expiresAt: Date;
  returnPath?: string | null;
}

const AuthStateSchema = new Schema<AuthState>({
  stateHash: { type: String, required: true, unique: true },
  returnPath: { type: String, default: null },
  expiresAt: { type: Date, required: true, expires: 0 }
});

export const AuthStateModel = model<AuthState>('AuthState', AuthStateSchema);
