import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query GetCampaigns {
      metaobjects(type: "partner_campaign", first: 20) {
        edges {
          node {
            id
            handle

            fields {
              key
              value

              reference {
                ... on MediaImage {
                  image {
                    url
                  }
                }
              }

              references(first: 10) {
                edges {
                  node {
                    ... on MediaImage {
                      image {
                        url
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `);

  const responseJson = await response.json();

  const campaigns =
    responseJson.data.metaobjects.edges.map((edge: any) => {
      const fields: Record<string, any> = {};

      edge.node.fields.forEach((field: any) => {

        // Single file
        if (field.reference?.image?.url) {
          fields[field.key] = field.reference.image.url;
        }

        // Multiple files
        else if (field.references?.edges?.length > 0) {
          fields[field.key] = field.references.edges.map(
            (item: any) => item.node.image.url
          );
        }

        // Normal fields
        else {
          fields[field.key] = field.value;
        }
      });

      return {
        id: edge.node.id,
        handle: edge.node.handle,
        ...fields,
      };
    });

  return json({ campaigns });
};