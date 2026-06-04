import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ error: "Unauthorized" }, { status: 401 });

  try {
    const response = await admin.graphql(`
      query GetSponsorshipRequests {
        metaobjects(type: "sponsorship_request", first: 50, reverse: true) {
          edges {
            node {
              id
              handle
              fields {
                key
                value
              }
            }
          }
        }
      }
    `);

    const data = await response.json();
    
    // Format the deeply nested GraphQL data into a clean, flat array of objects
    const requests = data.data.metaobjects.edges.map((edge: any) => {
      const fields = edge.node.fields.reduce((acc: any, field: any) => {
        acc[field.key] = field.value;
        return acc;
      }, {});

      return {
        id: edge.node.id,
        ...fields
      };
    });

    return json({ success: true, requests });
  } catch (error: any) {
    console.error("GET SPONSORSHIP REQUESTS ERROR:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}