export async function onInvoke(request, env) {
    try{
      // request data
      const requestJson = await request.json();
      const payload = JSON.parse(requestJson.payload);

      // events array contains one element
      const event = payload.events[0];

      // Key: Glia Operator ID
      // Value: Azure / Teams user ID
      const userMap = {
        'GLIA_OPERATOR_ID': 'TEAMS_USER_ID',
      };

      const clientId = env.MICROSOFT_CLIENT_ID;
      const clientSecret = env.MICROSOFT_CLIENT_SECRET;
      const tenantId = env.MICROSOFT_TENANT_ID;

      const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

      // Function to get the access token using client credentials
      console.log("getting token");
      async function getAccessToken() {
          const tokenRequestData = {
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            scope: 'https://graph.microsoft.com/.default',
          };
        
          try {
            const response = await fetch(tokenEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: new URLSearchParams(tokenRequestData)
            })
            const responseJson = await response.json();
            return responseJson.access_token
          } catch (error) {
            throw new Error('Error fetching access token: ' + error);
          }
        }

      // Function to clear the presence for a specific user
      async function clearPresence(accessToken, userId) {
          const headers = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          };
        
          const clearPresencePayload = {
              sessionId: clientId,
          };

          try {
            const response = await fetch(`https://graph.microsoft.com/beta/users/${userId}/presence/clearPresence`, {
              method: 'POST',
              headers: headers,
              body: JSON.stringify(clearPresencePayload)
            })
            const responseJson = await response.json();
            console.log('Presence cleared successfully:', responseJson);
            return responseJson
          } catch (error) {
            console.error('Error clearing presence:', error);
          }
        }


      // Function to set the presence for a specific user
      // using the preferred presence endpoint
      async function setPresence(accessToken, userId, newAvailability, newActivity) {
        const headers = {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        };

        const presenceUpdatePayload = {
          sessionId: clientId,
          availability: newAvailability,
          activity: newActivity,
          expirationDuration: 'PT1H',
        };

        try {
          console.log('Setting Presence to:', newAvailability, newActivity)
          const response = await fetch(`https://graph.microsoft.com/beta/users/${userId}/presence/setUserPreferredPresence`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(presenceUpdatePayload)
          })
          const responseJson = await response.text();
          console.log('Presence set successfully:', responseJson);
        } catch (error) {
          console.error('Error setting presence:', error);
        }
      }

      async function setStatusMessage(accessToken, userId, messageContent) {
        const headers = {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        };
        const statusMessageUpdatePayload = {
          statusMessage: {
            message: {
                content: messageContent,
                contentType: "text"
            }
          }
        }
        try {
          console.log('Setting Status Message to:', statusMessageUpdatePayload)
          const response = await fetch(`https://graph.microsoft.com/beta/users/${userId}/presence/setStatusMessage`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(statusMessageUpdatePayload)
          })
          const responseJson = await response.text();
          console.log('Status Message set successfully:', responseJson);
          return responseJson
        } catch (error) {
          console.error('Error setting Status Message:', JSON.stringify(error));
        }
      }

      // find the operator ID and operator email
      const operatorId = event.operator.id;
      const operatorEmail = event.operator.email;

      // find the availability status
      const availabilityStatus = event.availability_status;
      console.log(`Agent ${operatorEmail} is ${availabilityStatus}`)

      // find engagements array
      const engagements = event.engagements;
      // find post engagements array
      const postEngagements = event.post_engagements;

      // always fetch MS access token (are there scenarios where we do not update?)
      const accessToken = await getAccessToken();

      const microsoftUserId = userMap[operatorId];
      if (microsoftUserId){
        // TODO: Implement status mapping outside of this logic
        if (availabilityStatus == 'available') {
          // handle case where the agent is available
          // no engagements
          if (engagements.length > 0) {
            const statusMessageContent = `${engagements.length} interactions ongoing in Glia`
            console.log(statusMessageContent)
            const updatedStatusMessage = await setStatusMessage(accessToken, microsoftUserId, statusMessageContent)
            console.log('Status Message Updated in Teams: ', updatedStatusMessage)
            await setPresence(accessToken, microsoftUserId, 'Busy', 'Busy')
          }
          else {
            const statusMessageContent = 'Available in Glia'
            console.log(statusMessageContent)
            const updatedStatusMessage = await setStatusMessage(accessToken, microsoftUserId, statusMessageContent)
            console.log('Status Message Updated in Teams: ', updatedStatusMessage)
            await setPresence(accessToken, microsoftUserId, 'Available', 'Available')
          }
        }
        // think about this logical statement...
        else if (availabilityStatus == 'unavailable' || 'temporarily_unavailable') {
          // handle case where the agent is unavailable
          // find the unavailability reason
          if (engagements.length == 1) {
            const statusMessageContent = `${engagements.length} active interaction in Glia`
            console.log(statusMessageContent)
            const updatedStatusMessage = await setStatusMessage(accessToken, microsoftUserId, statusMessageContent)
            console.log('Status Message Updated in Teams: ', updatedStatusMessage)
            await setPresence(accessToken, microsoftUserId, 'Busy', 'Busy')
          }
          else if (engagements.length > 1) {
            const statusMessageContent = `${engagements.length} active interactions in Glia`
            console.log(statusMessageContent)
            const updatedStatusMessage = await setStatusMessage(accessToken, microsoftUserId, statusMessageContent)
            console.log('Status Message Updated in Teams: ', updatedStatusMessage)
            await setPresence(accessToken, microsoftUserId, 'Busy', 'Busy')
          } else if (postEngagements.length > 0 && engagements.length == 0) {
            const statusMessageContent = `Wrapping up an interaction in Glia`
            console.log(statusMessageContent)
            const updatedStatusMessage = await setStatusMessage(accessToken, microsoftUserId, statusMessageContent)
            console.log('Status Message Updated in Teams: ', updatedStatusMessage)
            await setPresence(accessToken, microsoftUserId, 'Busy', 'Busy')
          } else {
            const unavailabilityReasonCode = event.unavailability_reason_code;
            const statusMessageContent = `${unavailabilityReasonCode} in Glia`
            console.log(statusMessageContent)
            const updatedStatusMessage = await setStatusMessage(accessToken, microsoftUserId, statusMessageContent)
            console.log('Status Message Updated in Teams: ', updatedStatusMessage)
            if (unavailabilityReasonCode == 'training' || unavailabilityReasonCode == 'with-customer'){
              console.log(`unavailability reason code is ${unavailabilityReasonCode} setting Teams presence to Away`)
              await setPresence(accessToken, microsoftUserId, 'Away', 'Away')
            } else {
              console.log(`unavailability reason code is ${unavailabilityReasonCode} setting Teams presence to BeRightBack`)
              await setPresence(accessToken, microsoftUserId, 'BeRightBack', 'BeRightBack')
            }
          }
        }
      }
      return new Response(JSON.stringify({}));
    } catch(e) { 
      console.log(e); 
      return new Response(JSON.stringify({ error: e }))
    };
}