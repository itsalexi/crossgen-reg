/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as checkin from "../checkin.js";
import type * as emails from "../emails.js";
import type * as groupKey from "../groupKey.js";
import type * as http from "../http.js";
import type * as importGoogleForm from "../importGoogleForm.js";
import type * as organizer from "../organizer.js";
import type * as registrations from "../registrations.js";
import type * as shared from "../shared.js";
import type * as sheetSync from "../sheetSync.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  checkin: typeof checkin;
  emails: typeof emails;
  groupKey: typeof groupKey;
  http: typeof http;
  importGoogleForm: typeof importGoogleForm;
  organizer: typeof organizer;
  registrations: typeof registrations;
  shared: typeof shared;
  sheetSync: typeof sheetSync;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
