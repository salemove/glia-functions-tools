export async function onInvoke(request, env) {
    try{
      // request data
      const requestJson = await request.json();
      const payload = JSON.parse(requestJson.payload);

      // use an element in the events array
      const event = payload.events[0];

      // TODO: Build out data mapping between Glia and Teams
      const mappingArray = [
        {
          
        }
      ]

      // TODO: Get Microsoft access token

      // TODO: Set Presence and Set Status Message

      // find the operator ID and operator email
      const operatorId = event.operator.id;
      const operatorEmail = event.operator.email;

      // find the availability status
      const availabilityStatus = event.availability_status;
      console.log(`Agent ${operatorEmail} is ${availabilityStatus}`)

      // also check [engagements] ?
      if (availabilityStatus == 'available') {
        // handle case where the agent is available

      }

      if (availabilityStatus == 'unavailable') {
        // handle case where the agent is unavailable
        // find the unavailability reason
        const unavailabilityReasonCode = event.unavailability_reason_code;
        console.log(`Agent ${operatorEmail} is unavailable due to ${unavailabilityReasonCode}`)

      }
      return new Response(JSON.stringify({}));
    } catch(e) { 
      console.log(e); 
      return new Response(JSON.stringify({ error: e }))
    };
}