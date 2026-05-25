import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: any) {

  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query {
      metaobjects(type: "brand_application", first: 50) {
        edges {
          node {
            id
            handle

            capabilities {
              publishable {
                status
              }
            }

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

  console.log(
    "APPLICATIONS:",
    JSON.stringify(result, null, 2)
  );

  return json(result);

}