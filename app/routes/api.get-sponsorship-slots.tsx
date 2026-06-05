import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ error: "Unauthorized" }, { status: 401 });

  try {
    const response = await admin.graphql(`
      query GetSponsorshipSlots {
        metaobjects(type: "sponsorship_slot", first: 100, reverse: true) {
          edges {
            node {
              id
              handle
              fields {
                key
                value
                reference {
                  ... on MediaImage {
                    image { url }
                  }
                  ... on GenericFile {
                    url
                  }
                }
              }
            }
          }
        }
      }
    `);

    const data = await response.json();
    
    const slots = data.data.metaobjects.edges.map((edge: any) => {
      const fields = edge.node.fields.reduce((acc: any, field: any) => {
        let finalValue = field.value;
        
        // This is the magic check: If it's an image/file, grab the HTTP URL instead of the GID
        if (field.reference) {
          if (field.reference.image?.url) {
            finalValue = field.reference.image.url;
          } else if (field.reference.url) {
            finalValue = field.reference.url;
          }
        }
        
        acc[field.key] = finalValue;
        return acc;
      }, {});

      return { id: edge.node.id, handle: edge.node.handle, ...fields };
    });

    return json({ success: true, slots });
  } catch (error: any) {
    console.error("GET SPONSORSHIP SLOTS ERROR:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}