const os = require("os");
const {Resolver} = require('dns').promises;
var resolver = new Resolver();
const getCerts = require("./getCerts");


module.exports = async ()=>{
  var ifaces = os.networkInterfaces();
  for(var dev in ifaces){
    for (var id in ifaces[dev]){
      const details = ifaces[dev][id];
      if (details.family === 'IPv4'){
        // console.log("details", details.address);
        const domain = `ip-${details.address.replace(/\./g, "-")}.wrtc.dev`;
        if (details.address !== "127.0.0.1"){
          getCerts(details.address);
          let addresses;
          try{
            addresses = await resolver.resolve4(domain);
          }catch(e){
            console.log(`DNS resolve fail ${domain}`);
            continue;
          }
          if (!addresses.length){
            console.error(`Empty response from domain ${domain}`)
            continue;
          }else if (addresses[0] !== details.address){
            console.error(`Wrong DNS IP address for domain ${domain}: ${addresses.join()}`);
            continue;
          }else {
            return domain;
          }
        }
      }
    }
  }
  const domain = `ip-${'127.0.0.1'.replace(/\./g, "-")}.wrtc.dev`;
  return domain;
}
