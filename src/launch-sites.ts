/** Curated major orbital launch facilities; approximate site centers, not individual pads.
 * Coordinates: Jonathan McDowell's GCAT sites table, retrieved 2026-10-30.
 * https://planet4589.org/space/gcat/tsv/tables/sites.tsv
 * Inclusion is geographic context, not a statement that a site is currently launching.
 */
export const LAUNCH_SITES = [
  { id:'vandenberg', name:'Vandenberg', country:'United States', lat:34.63, lng:-120.61 },
  { id:'canaveral', name:'Cape Canaveral', country:'United States', lat:28.46, lng:-80.54 },
  { id:'kennedy', name:'Kennedy Space Center', country:'United States', lat:28.6083, lng:-80.6041 },
  { id:'starbase', name:'Starbase', country:'United States', lat:25.9964, lng:-97.1536 },
  { id:'wallops', name:'Wallops / Mid-Atlantic', country:'United States', lat:37.83, lng:-75.48 },
  { id:'kodiak', name:'Pacific Spaceport Alaska', country:'United States', lat:57.4359, lng:-152.3378 },
  { id:'kourou', name:'Guiana Space Centre', country:'French Guiana', lat:5.2333, lng:-52.7517 },
  { id:'alcantara', name:'Alcântara', country:'Brazil', lat:-2.317, lng:-44.3671 },
  { id:'andoya', name:'Andøya', country:'Norway', lat:69.2943, lng:16.0207 },
  { id:'plesetsk', name:'Plesetsk', country:'Russia', lat:62.9, lng:40.5 },
  { id:'baikonur', name:'Baikonur', country:'Kazakhstan', lat:46, lng:63 },
  { id:'vostochny', name:'Vostochny', country:'Russia', lat:51.884, lng:128.333 },
  { id:'jiuquan', name:'Jiuquan', country:'China', lat:41.31, lng:100.31 },
  { id:'taiyuan', name:'Taiyuan', country:'China', lat:37.5, lng:112.6 },
  { id:'xichang', name:'Xichang', country:'China', lat:28.2472, lng:102.0291 },
  { id:'wenchang', name:'Wenchang', country:'China', lat:19.6142, lng:110.9511 },
  { id:'hainan', name:'Hainan Commercial', country:'China', lat:19.5968, lng:110.9308 },
  { id:'sriharikota', name:'Satish Dhawan / Sriharikota', country:'India', lat:13.621, lng:80.303 },
  { id:'tanegashima', name:'Tanegashima', country:'Japan', lat:30.4, lng:130.97 },
  { id:'uchinoura', name:'Uchinoura', country:'Japan', lat:31.25, lng:131.079 },
  { id:'naro', name:'Naro', country:'South Korea', lat:34.4318, lng:127.5363 },
  { id:'sohae', name:'Sohae', country:'North Korea', lat:39.66, lng:124.706 },
  { id:'semnan', name:'Semnan', country:'Iran', lat:35.2347, lng:53.921 },
  { id:'shahroud', name:'Shahroud', country:'Iran', lat:36.23, lng:55.33 },
  { id:'palmachim', name:'Palmachim', country:'Israel', lat:31.9, lng:34.7 },
  { id:'mahia', name:'Māhia / Launch Complex 1', country:'New Zealand', lat:-39.2609, lng:177.8655 },
  { id:'bowen', name:'Bowen Orbital Spaceport', country:'Australia', lat:-19.9582, lng:148.1136 },
];
