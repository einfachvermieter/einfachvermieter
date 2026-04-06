import type { ZodErrorMap } from "zod";
import { messageKey } from "./messageKey.js";

export const i18nZodErrorMap: ZodErrorMap = (issue) => {
  switch (issue.code) {
    case "invalid_type":
      if (issue.input === undefined || issue.input === null) {
        return { message: messageKey("validation.required") };
      }

      if (issue.expected === "date") {
        return { message: messageKey("validation.invalidDate") };
      }

      return { message: messageKey("validation.generic") };

    case "too_small": {
      if (issue.origin === "string") {
        return {
          message:
            Number(issue.minimum) === 1
              ? messageKey("validation.required")
              : messageKey("validation.tooShort", {
                  min: Number(issue.minimum),
                }),
        };
      }
      return {
        message: messageKey("validation.numberMin", {
          min: Number(issue.minimum),
        }),
      };
    }

    case "too_big": {
      if (issue.origin === "string") {
        return {
          message: messageKey("validation.tooLong", {
            max: Number(issue.maximum),
          }),
        };
      }

      return {
        message: messageKey("validation.numberMax", {
          max: Number(issue.maximum),
        }),
      };
    }

    case "invalid_format":
      if (issue.format === "email") {
        return { message: messageKey("validation.invalidEmail") };
      }

      return { message: messageKey("validation.generic") };

    default:
      return;
  }
};
