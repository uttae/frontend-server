import { BookmarkFoldersProvider } from "./context";

export default function BookmarkLayout({ children }: { children: React.ReactNode }) {
  return <BookmarkFoldersProvider>{children}</BookmarkFoldersProvider>;
}
