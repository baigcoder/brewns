
export interface Location {
  id: string;
  code: string;
  name: string;
  district: string;
  address: string;
  city: string;
  hours: string;
  phone: string;
  mapUrl: string;
  seating: string;
}

export const LOCATIONS: Location[] = [
  {
    id: 'mission-district',
    code: '01',
    name: 'MISSION ROASTERY & LAB',
    district: 'Mission District',
    address: '139 COFFEE STREET',
    city: 'SAN FRANCISCO, CA 94110',
    hours: 'OPEN DAILY 07:00 – 21:00',
    phone: '(415) 529-8812',
    mapUrl: 'https://maps.google.com/?q=139+Coffee+Street+San+Francisco+CA',
    seating: 'Roastery bar, outdoor courtyard, cupping room',
  },
  {
    id: 'valencia-corridor',
    code: '02',
    name: 'VALENCIA ESPRESSO BAR',
    district: 'Valencia Corridor',
    address: '310 VALENCIA STREET',
    city: 'SAN FRANCISCO, CA 94103',
    hours: 'OPEN DAILY 07:00 – 21:00',
    phone: '(415) 529-8815',
    mapUrl: 'https://maps.google.com/?q=310+Valencia+Street+San+Francisco+CA',
    seating: 'Standing espresso ledge & sidewalk benches',
  },
  {
    id: 'jackson-square',
    code: '03',
    name: 'JACKSON SQUARE ATELIER',
    district: 'North Beach / Jackson Square',
    address: '56 COLUMBUS AVENUE',
    city: 'SAN FRANCISCO, CA 94133',
    hours: 'OPEN DAILY 07:00 – 20:00',
    phone: '(415) 529-8819',
    mapUrl: 'https://maps.google.com/?q=56+Columbus+Avenue+San+Francisco+CA',
    seating: 'Cast-concrete banquettes & window bar',
  },
];
