// Renders a layout JSON of blocks: { sections: [{ blocks: [{type, props}, ...] }] }
import { BlockRegistry } from "@/lib/blocks/registry";

export default function PageRenderer({ layout }: { layout: any }) {
  const sections = Array.isArray(layout?.sections) ? layout.sections : [];
  return (
    <>
      {sections.map((section: any, si: number) => (
        <section key={si}>
          {Array.isArray(section.blocks) &&
            section.blocks.map((blk: any, bi: number) => {
              const Cmp = BlockRegistry[blk?.type as keyof typeof BlockRegistry];
              if (!Cmp) return null;
              return <Cmp key={`${blk.type}-${bi}`} {...(blk.props || {})} />;
            })}
        </section>
      ))}
    </>
  );
}
