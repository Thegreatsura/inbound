import { RichText } from "basehub/react-rich-text";
import { CodeBlock } from "basehub/react-code-block";
import { BaseHubImage } from "basehub/next-image";

interface RichTextRendererProps {
  content: any;
}

export function RichTextRenderer({ content }: RichTextRendererProps) {
  return (
    <RichText
      components={{
        // Custom code block component with syntax highlighting
        pre: ({ children, ...props }) => {
          // Handle code blocks
          const codeContent = typeof children === "string" ? children : props?.code || "";
          if (codeContent) {
            return (
              <CodeBlock
                theme="github-dark"
                snippets={[{ code: codeContent, language: props?.language || "plaintext" }]}
                {...props}
              />
            );
          }
          // Fallback to default pre element
          return <pre {...props}>{children}</pre>;
        },
        
        // Enhanced code component for inline code
        code: ({ children, ...props }) => {
          if (typeof children === "string" && children.includes("\n")) {
            // Multi-line code, treat as code block
            return (
              <CodeBlock
                theme="github-dark"
                snippets={[{ code: children, language: "plaintext" }]}
              />
            );
          }
          // Inline code
          return (
            <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono" {...props}>
              {children}
            </code>
          );
        },

        // Enhanced image component
        img: ({ src, alt, ...props }) => {
          if (src) {
            return (
              <BaseHubImage
                src={src}
                alt={alt || ""}
                width={800}
                height={400}
                className="rounded-lg border border-border"
                style={{ display: "block", margin: "2rem auto" }}
                {...props}
              />
            );
          }
          return <img src={src} alt={alt} {...props} />;
        },

        // Enhanced blockquote
        blockquote: ({ children, ...props }) => (
          <blockquote
            className="border-l-4 border-primary/20 bg-muted/30 pl-6 py-2 my-6 italic"
            {...props}
          >
            {children}
          </blockquote>
        ),

        // Enhanced table components
        table: ({ children, ...props }) => (
          <div className="overflow-x-auto my-6">
            <table className="w-full border-collapse border border-border" {...props}>
              {children}
            </table>
          </div>
        ),
        
        th: ({ children, ...props }) => (
          <th
            className="border border-border bg-muted/50 px-4 py-2 text-left font-semibold"
            {...props}
          >
            {children}
          </th>
        ),
        
        td: ({ children, ...props }) => (
          <td className="border border-border px-4 py-2" {...props}>
            {children}
          </td>
        ),

        // Enhanced list items
        ul: ({ children, ...props }) => (
          <ul className="list-disc list-outside space-y-2 my-4 ml-6 pl-0" {...props}>
            {children}
          </ul>
        ),
        
        ol: ({ children, ...props }) => (
          <ol className="list-decimal list-outside space-y-2 my-4 ml-6 pl-0" {...props}>
            {children}
          </ol>
        ),
        
        li: ({ children, ...props }) => (
          <li className="leading-7" {...props}>
            {children}
          </li>
        ),

        // Enhanced headings with anchor links
        h1: ({ children, ...props }) => (
          <h1 className="text-4xl font-bold tracking-tight mb-6 mt-8" {...props}>
            {children}
          </h1>
        ),
        
        h2: ({ children, ...props }) => (
          <h2 className="text-3xl font-semibold tracking-tight mb-4 mt-8" {...props}>
            {children}
          </h2>
        ),
        
        h3: ({ children, ...props }) => (
          <h3 className="text-2xl font-semibold tracking-tight mb-3 mt-6" {...props}>
            {children}
          </h3>
        ),

        // Enhanced paragraph spacing
        p: ({ children, ...props }) => (
          <p className="leading-7 mb-2" {...props}>
            {children}
          </p>
        ),
      }}
    >
      {content}
    </RichText>
  );
}