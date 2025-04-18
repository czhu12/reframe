import { ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { redirect, useLoaderData, useSearchParams } from "@remix-run/react";
import Instructions from "~/components/core/instructions";
import AddFrame from "~/components/core/add-frame";
import { Responsive, WidthProvider } from "react-grid-layout";
import { extractFrameData, useWindowSize } from "~/lib/utils";

import { prisma } from "~/db.server";
import Frame from "~/components/core/frame";
import Collections from "~/components/core/collections";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";
import { Menu } from "lucide-react";
import Confetti from "react-confetti";

const ResponsiveGridLayout = WidthProvider(Responsive);

export const meta: MetaFunction = ({ params }) => {
  return [
    { title: `${params.username}'s Frames` },
    { name: "description", content: `${params.username}'s collection of frames.` },
    { property: "og:title", content: `${params.username}'s Frames` },
    { property: "og:type", content: "website" },
    { property: "og:url", content: `https://reframe.canine.sh/frames/${params.username}` },
    { property: "og:image", content: "https://reframe.canine.sh/dashboard-og.png" },
    { property: "og:description", content: `${params.username}'s collection of frames.` },
    { property: "twitter:card", content: "summary_large_image" },
    { property: "twitter:domain", content: `reframe.canine.sh/frames/${params.username}` },
    { property: "twitter:url", content: `https://reframe.canine.sh/frames/${params.username}` },
    { property: "twitter:title", content: `${params.username}'s Frames` },
    { property: "twitter:description", content: `${params.username}'s collection of frames.` },
    { property: "twitter:image", content: "https://reframe.canine.sh/dashboard-og.png" },
  ];
};

export async function loader({params, request}: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const user = await prisma.user.findUnique({
    where: {
      username: params.username.toLowerCase(),
    },
  });
  const collectionId = url.searchParams.get("collectionId");
  // Use the first collection if no collectionId is provided
  const condition = collectionId ? { id: collectionId } : { userId: user?.id };
  const collection = await prisma.collection.findFirst({
    where: condition,
    include: {
      frames: true
    }
  });
  const collections = await prisma.collection.findMany({
    where: {
      userId: user?.id,
    },
  });

  if (!user) {
    throw new Response("User not found", { status: 404 });
  }
  if (!collection) {
    throw new Response("Collection not found", { status: 404 });
  }

  delete user.id
  delete collection.userId;
  collections.forEach((collection: any) => delete collection.userId);
  return { user, collection, collections };
}

export async function action({request, params}: ActionFunctionArgs) {
  const formData = await request.formData();
  // This implements authentication
  const user = await prisma.user.findUnique({
    where: {
      username: params.username,
    },
  });

  if (!user) {
    throw new Response("User not found", { status: 404 });
  }

  const userId = formData.get("userId") as string;

  if (user.id !== userId) {
    throw new Response("User does not match", { status: 403 });
  }
  // Passes authentication

  const intent = formData.get("intent") as string;
  if (intent === "create-collection") {
    const name = formData.get("name") as string;
    const collection = await prisma.collection.create({
      data: { name, userId: user.id },
    });
    return redirect(`/${user.username}?collectionId=${collection.id}&secret=${userId}`);
  } else if (intent === "delete") {
    const id = formData.get("id") as string;

    await prisma.frame.delete({
      where: { id },
    });
  } else if (intent === "update") {
    const id = formData.get("id") as string;
    const frameData = extractFrameData(formData);
    await prisma.frame.update({
      where: { id },
      data: frameData,
    });
  } else {
    const collectionId = formData.get("collectionId") as string;
    const frameData = extractFrameData(formData);
    await prisma.frame.create({
      data: { ...frameData, collectionId: collectionId},
    });
  }

  return new Response(null, { status: 200 });
}

export default function Frames() {
  const { user, collection, collections } = useLoaderData<typeof loader>();
  // get the search params userId
  const [searchParams, setSearchParams] = useSearchParams();
  const userId = searchParams.get("secret");

  // This needs to layout the frames in a grid, which is 12 columns on xl and 4 on md, and 2 on sm, and 1 on xs
  const frameLayout = collection?.frames.map((frame: any) => ({
    i: frame.id,
    x: frame.x,
    y: frame.y,
    w: frame.width,
    h: frame.height
  }));

  const { width, height } = useWindowSize();

  return (
    <main className="p-4">
      {(collection?.frames.length === 0 && collections.length === 1) ? (
        <div>
          <Confetti width={width} height={height} recycle={false} numberOfPieces={500} tweenDuration={10000} />
          <div className="mt-10">
            <div className="text-center py-10">
              <Instructions username={user.username} userId={userId} />
              <div className="mt-10">
                <p className="text-2xl font-bold">No frames yet...</p>
                <p className="text-lg mb-3">Click on "Add new frame" to add your first frame.</p>
                <AddFrame userId={userId} collectionId={collection.id} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-8 container mx-auto">
            <div className="flex justify-between items-center">
              {/* Show on larger screens, hide on small */}
              <div className="hidden sm:flex justify-between items-center w-full">
                <Collections
                  userId={userId}
                  username={user.username}
                  collections={collections}
                  currentCollection={collection}
                />
                <div>
                  <h1 className="text-2xl font-bold">{user.username}'s Frames</h1>
                </div>
                <AddFrame userId={userId} collectionId={collection.id} />
              </div>

              {/* Show on small screens, hide on larger */}
              <div className="sm:hidden flex justify-between items-center w-full">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[300px]">
                    <div className="flex flex-col gap-4 pt-6">
                      <Collections
                        userId={userId}
                        username={user.username}
                        collections={collections}
                        currentCollection={collection}
                      />
                      <AddFrame userId={userId} collectionId={collection.id} />
                    </div>
                  </SheetContent>
                </Sheet>
                <h1 className="text-2xl font-bold">{user.username}'s Frames</h1>
              </div>
            </div>
          </div>
          <ResponsiveGridLayout
            className="layout"
            layouts={{ lg: frameLayout, md: frameLayout, sm: frameLayout, xs: frameLayout, xxs: frameLayout }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 6, md: 4, sm: 2, xs: 1, xxs: 1 }}
            useCSSTransforms={true}
            isResizable={false}
            isDraggable={false}
            margin={[10, userId ? 50 : 25]}
          >
            {collection?.frames.map((frame: any) => (
              <div key={frame.id}>
                <Frame frame={frame} userId={userId} collectionId={collection.id} />
              </div>
            ))}
          </ResponsiveGridLayout>
        </div>
      )}
      <footer className="text-center text-xs text-gray-500 mt-6">
        Create your own with <a href="/" className="font-bold italic text-blue-600 logo [text-shadow:_0_1px_3px_rgba(37,99,235,0.2)]">reframe</a>
      </footer>
    </main>
  );
}