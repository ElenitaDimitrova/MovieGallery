import "express-session";

declare module "express-session" {
  interface SessionData {
    auth?: {
      userId: number;
      username: string;
      role: "registered";
    };
    guestId?: string;
    flash?: {
      type: "error" | "success";
      message: string;
    };
  }
}