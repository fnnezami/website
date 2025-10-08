// Central whitelist of components that modules can use.
import dynamic from "next/dynamic";

export type BlockType =
  | "MDXContent"         // optional: long-form content
  | "AssistantWidget";   // future chat assistant

export const BlockRegistry: Record<BlockType, React.ComponentType<any>> = {
  MDXContent: dynamic(() => import("@/modules/MDXContent")),       // you can stub now 
  AssistantWidget: dynamic(() => import("@/modules/AssistantWidget")),
};
