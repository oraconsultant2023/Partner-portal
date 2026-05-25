import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: any) {

  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query {

      metaobjectDefinitions(first: 20) {

        edges {

          node {

            name
            type

          }

        }

      }

    }
  `);

  const data = await response.json();

  console.log("METAOBJECT DEFINITIONS:");
  console.log(JSON.stringify(data, null, 2));

  return json(data);

}