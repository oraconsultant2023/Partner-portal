import { json } from "@remix-run/node";
// import { authenticate } from "../shopify.server";

export async function loader({ request }: any) {
  // Temporarily bypass auth to test routing
  // const { admin } = await authenticate.admin(request);

  return json({
    success: true,
    message: "Applications route working"
  });
}