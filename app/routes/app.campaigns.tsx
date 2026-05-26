import { json }
from "@remix-run/node";

import {
  useLoaderData
}
from "react-router";

import {
  authenticate
}
from "../shopify.server";

export async function loader({
  request
}: any) {

  const { admin } =
    await authenticate.admin(
      request
    );

  // FETCH METAOBJECTS
  const response =
    await admin.graphql(`

      query {

        metaobjects(
          type: "partner_campaign",
          first: 20
        ) {

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

  const result =
    await response.json();

  console.log(
    "CAMPAIGNS:",
    JSON.stringify(
      result,
      null,
      2
    )
  );

  // FORMAT FIELDS
  const campaigns =
    result.data.metaobjects.edges
      .map((edge: any) => {

        const fields: any = {};

        edge.node.fields.forEach(
          (field: any) => {

            fields[field.key] =
              field.value;

          }
        );

        return {

          id:
            edge.node.id,

          handle:
            edge.node.handle,

          ...fields

        };

      });

  return json({
    campaigns
  });

}

export default function Campaigns() {

  const { campaigns } =
    useLoaderData<any>();

  return (

    <div
      style={{
        padding: "40px"
      }}
    >

      <h1>
        Campaigns
      </h1>

      <pre>
        {
          JSON.stringify(
            campaigns,
            null,
            2
          )
        }
      </pre>

    </div>

  );

}