import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: any) {

  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query {
      metaobjects(first: 50, type: "brand_application") {
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

  const result = await response.json();

  console.log("APPLICATIONS:", JSON.stringify(result, null, 2));

  return json(result);
}