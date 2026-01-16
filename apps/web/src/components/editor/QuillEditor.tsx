'use client';

import { useEffect, useRef, useState } from 'react';
import 'quill/dist/quill.snow.css';

interface QuillEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  onImageUpload?: (file: File) => Promise<string>;
}

export default function QuillEditor({
  value,
  onChange,
  placeholder = 'Write your content here...',
  className = '',
  minHeight = '300px',
  onImageUpload,
}: QuillEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const initializedRef = useRef(false);

  // Initialize Quill only once
  useEffect(() => {
    // Prevent double initialization in Strict Mode
    if (initializedRef.current || typeof window === 'undefined') return;
    
    const initQuill = async () => {
      try {
        const Quill = (await import('quill')).default;

        // Check if already initialized or container doesn't exist
        if (!containerRef.current || quillRef.current) return;

        // Create a fresh editor div
        const editorDiv = document.createElement('div');
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(editorDiv);

        // Quill toolbar configuration
        const toolbarOptions = [
          [{ header: [1, 2, 3, 4, 5, 6, false] }],
          [{ font: [] }],
          [{ size: ['small', false, 'large', 'huge'] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ color: [] }, { background: [] }],
          [{ script: 'sub' }, { script: 'super' }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ indent: '-1' }, { indent: '+1' }],
          [{ direction: 'rtl' }],
          [{ align: [] }],
          ['blockquote', 'code-block'],
          ['link', 'image', 'video'],
          ['clean'],
        ];

        const quill = new Quill(editorDiv, {
          theme: 'snow',
          placeholder,
          modules: {
            toolbar: toolbarOptions,
            history: {
              delay: 1000,
              maxStack: 50,
              userOnly: true,
            },
          },
        });

        quillRef.current = quill;
        initializedRef.current = true;

        // Set initial value
        if (value) {
          quill.root.innerHTML = value;
        }

        // Handle text changes
        quill.on('text-change', () => {
          const html = quill.root.innerHTML;
          onChange(html === '<p><br></p>' ? '' : html);
        });

        // Custom image handler
        if (onImageUpload) {
          const toolbar = quill.getModule('toolbar') as any;
          toolbar?.addHandler('image', () => {
            const input = document.createElement('input');
            input.setAttribute('type', 'file');
            input.setAttribute('accept', 'image/*');
            input.click();

            input.onchange = async () => {
              const file = input.files?.[0];
              if (!file) return;

              try {
                const url = await onImageUpload(file);
                const range = quill.getSelection(true);
                quill.insertEmbed(range.index, 'image', url);
                quill.setSelection(range.index + 1);
              } catch (error) {
                console.error('Image upload failed:', error);
              }
            };
          });
        }

        setIsReady(true);
      } catch (error) {
        console.error('Failed to initialize Quill:', error);
      }
    };

    initQuill();

    // Cleanup on unmount
    return () => {
      if (quillRef.current) {
        quillRef.current = null;
      }
      initializedRef.current = false;
    };
  }, []);

  // Update content when value prop changes externally
  useEffect(() => {
    if (quillRef.current && isReady) {
      const currentContent = quillRef.current.root.innerHTML;
      const normalizedCurrent = currentContent === '<p><br></p>' ? '' : currentContent;
      if (value !== normalizedCurrent) {
        const selection = quillRef.current.getSelection();
        quillRef.current.root.innerHTML = value || '';
        if (selection) {
          quillRef.current.setSelection(selection);
        }
      }
    }
  }, [value, isReady]);

  return (
    <div className={`quill-editor-wrapper ${className}`}>
      <style jsx global>{`
        .quill-editor-wrapper .ql-container {
          min-height: ${minHeight};
          font-size: 16px;
          font-family: inherit;
        }
        .quill-editor-wrapper .ql-editor {
          min-height: ${minHeight};
        }
        .quill-editor-wrapper .ql-toolbar {
          border-top-left-radius: 0.5rem;
          border-top-right-radius: 0.5rem;
          background: #f9fafb;
          border-color: #d1d5db;
        }
        .quill-editor-wrapper .ql-container {
          border-bottom-left-radius: 0.5rem;
          border-bottom-right-radius: 0.5rem;
          border-color: #d1d5db;
          background: white;
        }
        .dark .quill-editor-wrapper .ql-toolbar {
          background: #374151;
          border-color: #4b5563;
        }
        .dark .quill-editor-wrapper .ql-container {
          background: #1f2937;
          border-color: #4b5563;
        }
        .dark .quill-editor-wrapper .ql-editor {
          color: #f3f4f6;
        }
        .dark .quill-editor-wrapper .ql-editor.ql-blank::before {
          color: #9ca3af;
        }
        .dark .quill-editor-wrapper .ql-stroke {
          stroke: #d1d5db;
        }
        .dark .quill-editor-wrapper .ql-fill {
          fill: #d1d5db;
        }
        .dark .quill-editor-wrapper .ql-picker {
          color: #d1d5db;
        }
        .dark .quill-editor-wrapper .ql-picker-options {
          background: #374151;
          border-color: #4b5563;
        }
        .dark .quill-editor-wrapper .ql-picker-item:hover {
          color: #60a5fa;
        }
        .quill-editor-wrapper .ql-editor img {
          max-width: 100%;
          height: auto;
        }
        .quill-editor-wrapper .ql-editor pre.ql-syntax {
          background-color: #1e293b;
          color: #e2e8f0;
          border-radius: 0.375rem;
          padding: 1rem;
          overflow-x: auto;
        }
        .quill-editor-wrapper .ql-editor blockquote {
          border-left: 4px solid #3b82f6;
          padding-left: 1rem;
          margin-left: 0;
          color: #6b7280;
        }
        .dark .quill-editor-wrapper .ql-editor blockquote {
          color: #9ca3af;
        }
      `}</style>
      
      {!isReady && (
        <div 
          className="border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center"
          style={{ minHeight }}
        >
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
      
      <div 
        ref={containerRef}
        style={{ display: isReady ? 'block' : 'none' }}
      />
    </div>
  );
}
