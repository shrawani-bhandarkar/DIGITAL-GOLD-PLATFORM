import { useEffect } from 'react';

export default function useDocumentTitle(title) {
  useEffect(() => {
    document.title = `${title} | Digital Gold Admin`;
  }, [title]);
}
