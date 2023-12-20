export async function onInvoke(request, env) {
    try{
      // request data
      const requestJson = await request.json();
      const payload = JSON.parse(requestJson.payload);

      // TODO: Build out data mapping between Glia and Teams
      const mappingArray = [
        {
          
        }
      ]

      // TODO: Get Microsoft access token

      // TODO: Set Presence and Set Status Message

      // find the operator ID and operator email
      const operatorId = payload.operator.id;
      const operatorEmail = payload.operator.email;

      // find the availability status
      const availabilityStatus = payload.availability_status;
      console.log(`Agent ${operatorEmail} is ${availabilityStatus}`)

      // also check [engagements] ?
      if (availabilityStatus == 'available') {
        // handle case where the agent is available

      }

      if (availabilityStatus == 'unavailable') {
        // handle case where the agent is unavailable
        // find the unavailability reason
        const unavailabilityReasonCode = payload.unavailability_reason_code;
        console.log(`Agent ${operatorEmail} is unavailable due to ${unavailabilityReasonCode}`)

      }
      return new Response(JSON.stringify({}));
    } catch(e) { 
      console.log(e); 
      return new Response(JSON.stringify({ error: e }))
    };
}