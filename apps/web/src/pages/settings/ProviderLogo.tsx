import type { AiProvider } from "@einfachvermieter/shared";
import anthropicLogo from "@/img/ai-provider/anthropic.svg";
import geminiLogo from "@/img/ai-provider/gemini.svg";
import mistralLogo from "@/img/ai-provider/mistral.svg";
import ollamaLogo from "@/img/ai-provider/ollama.svg";
import ollamaDarkLogo from "@/img/ai-provider/ollama-dark.svg";
import openaiLogo from "@/img/ai-provider/openai.svg";
import openaiDarkLogo from "@/img/ai-provider/openai-dark.svg";
import { cn } from "@/lib/utils";

/**
 * Logos der Anbieter.
 *
 * `scale` ist notwendig, weil das OpenAI Logo nicht verändert werden darf
 * aber die Grafik zu viel Padding enthält.
 */
const LOGOS: Record<
  AiProvider,
  { light: string; dark?: string; scale?: string }
> = {
  mistral: { light: mistralLogo },
  openai: { light: openaiLogo, dark: openaiDarkLogo, scale: "scale-[1.65]" },
  anthropic: { light: anthropicLogo },
  gemini: { light: geminiLogo },
  ollama: { light: ollamaLogo, dark: ollamaDarkLogo },
};

/**
 * Logo eines KI-Anbieters
 */
export const ProviderLogo = ({ provider }: { provider: AiProvider }) => {
  const { light, dark, scale } = LOGOS[provider];
  const base = cn("size-full object-contain", scale);

  if (!dark) {
    return <img src={light} alt="" className={base} />;
  }

  return (
    <>
      <img src={light} alt="" className={cn(base, "dark:hidden")} />
      <img src={dark} alt="" className={cn(base, "hidden dark:block")} />
    </>
  );
};
