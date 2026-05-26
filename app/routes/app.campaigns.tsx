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
        padding: "40px",
        background: "#f6f6f7",
        minHeight: "100vh"
      }}
    >

      <h1
        style={{
          fontSize: "32px",
          fontWeight: "700",
          marginBottom: "30px"
        }}
      >
        Partner Campaigns
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(350px,1fr))",
          gap: "24px"
        }}
      >

        {campaigns.map(
          (campaign: any) => (

            <div
              key={campaign.id}

              style={{

                background: "#fff",

                borderRadius: "18px",

                padding: "24px",

                boxShadow:
                  "0 4px 20px rgba(0,0,0,0.08)"

              }}
            >

              {/* TOP */}

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  marginBottom: "16px"
                }}
              >

                <div
                  style={{
                    background:
                      "#eef2ff",
                    color: "#4338ca",
                    padding:
                      "6px 12px",
                    borderRadius:
                      "30px",
                    fontSize: "12px",
                    fontWeight: "600"
                  }}
                >
                  {
                    campaign.campaign_type
                  }
                </div>

                <div
                  style={{
                    background:
                      campaign.status ===
                      "Active"

                        ? "#dcfce7"

                        : "#f3f4f6",

                    color:
                      campaign.status ===
                      "Active"

                        ? "#166534"

                        : "#111827",

                    padding:
                      "6px 12px",

                    borderRadius:
                      "30px",

                    fontSize: "12px",

                    fontWeight: "600"
                  }}
                >
                  {
                    campaign.status
                  }
                </div>

              </div>

              {/* TITLE */}

              <h2
                style={{
                  fontSize: "24px",
                  fontWeight: "700",
                  marginBottom: "12px"
                }}
              >
                {
                  campaign.campaign_name
                }
              </h2>

              {/* SUMMARY */}

              <p
                style={{
                  color: "#4b5563",
                  lineHeight: "1.7",
                  marginBottom: "20px"
                }}
              >
                {
                  campaign.campaign_summary
                }
              </p>

              {/* META */}

              <div
                style={{
                  marginBottom: "20px"
                }}
              >

                <div
                  style={{
                    marginBottom: "10px"
                  }}
                >
                  <strong>
                    Budget:
                  </strong>

                  {" "}

                  {
                    campaign.budget
                  }
                </div>

                <div
                  style={{
                    marginBottom: "10px"
                  }}
                >
                  <strong>
                    Category:
                  </strong>

                  {" "}

                  {
                    campaign.target_category
                  }
                </div>

                <div
                  style={{
                    marginBottom: "10px"
                  }}
                >
                  <strong>
                    Start:
                  </strong>

                  {" "}

                  {
                    campaign.start_date
                  }
                </div>

                <div>
                  <strong>
                    End:
                  </strong>

                  {" "}

                  {
                    campaign.end_date
                  }
                </div>

              </div>

              {/* BUTTON */}

              <button

                style={{

                  width: "100%",

                  border: "none",

                  background: "#111827",

                  color: "#fff",

                  padding: "14px",

                  borderRadius: "12px",

                  fontWeight: "600",

                  cursor: "pointer"

                }}

              >
                View Campaign
              </button>

            </div>

          )
        )}

      </div>

    </div>

  );

}

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