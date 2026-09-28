import { model, Schema } from 'mongoose';

export interface AuthState {
  stateHash: string;
  expiresAt: Date;
}

const AuthStateSchema = new Schema<AuthState>({
  stateHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 }
});

export const AuthStateModel = model<AuthState>('AuthState', AuthStateSchema);
