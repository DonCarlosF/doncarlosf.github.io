import { NotFoundMessage } from "@/components/layout/NotFoundMessage";

/** Shown when a known section calls notFound() — the site layout already has the header. */
export default function SiteNotFound() {
  return <NotFoundMessage />;
}
