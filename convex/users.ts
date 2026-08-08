import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

/** The signed-in user, or null. Used to prefill the registrant's details. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const user = await ctx.db.get(userId);
    if (user === null) return null;

    return {
      _id: user._id,
      name: user.name ?? "",
      email: user.email ?? "",
      image: user.image ?? null,
    };
  },
});
