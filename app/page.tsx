import { Suspense } from "react";
import HomeClient from "./home-client";

const Loading = () => (
  <div className="min-h-screen kuromi-candy-bg" />
);

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <HomeClient />
    </Suspense>
  );
}
