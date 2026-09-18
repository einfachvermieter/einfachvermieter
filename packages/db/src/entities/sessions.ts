import { EntitySchema, type Opt } from "@mikro-orm/core";
import { currentTimestamp } from "./_defaults.js";
import { fk } from "./_relations.js";
import { UserSchema } from "./tenants.js";

/**
 * Login-Session mit id als Cookie
 */
export type Session = {
  id: string;
  userId: string;
  expiresAt: string;
  createdAt: Opt<string>;
};

export const SessionSchema = new EntitySchema<Session>({
  name: "Session",
  tableName: "sessions",
  properties: {
    // Kein onCreate: die id wird explizit als Token-Hash gesetzt.
    id: { type: "string", primary: true },
    userId: fk(() => UserSchema, "user_id", "cascade"),
    expiresAt: { type: "string", fieldName: "expires_at" },
    createdAt: {
      type: "string",
      fieldName: "created_at",
      defaultRaw: currentTimestamp,
    },
  },
  indexes: [{ name: "sessions_user_id", properties: ["userId"] }],
});
