import { SourceRow } from "../migration-tool.mapping";

export const CTRCOUNTRY2_SAMPLES: SourceRow[] = [
  { COUNTRYNAME: "Afghanistan", COUNTRYCODE: "1" },
  { COUNTRYNAME: "Aland Islands", COUNTRYCODE: "243" },
  { COUNTRYNAME: "Albania", COUNTRYCODE: "2" },
  { COUNTRYNAME: "Antigua and Barbuda", COUNTRYCODE: "9" },
  { COUNTRYNAME: "Brazil", COUNTRYCODE: "29" },
  { COUNTRYNAME: "Yemen", COUNTRYCODE: "239" },
];

export const TB_MST_COUNTRY_SAMPLES: SourceRow[] = [
  {
    CountryId: 6,
    CountryName: "ANTIGUA AND BARBUDA",
    LRSCode: "AG",
    Nationality: "ANTIGUA AND BARBUDA",
    RiskCateg: "Low",
    LimitCategory: "Normal",
    Limits: 3000.0,
    CTRCode: "1-268",
    bActive: 1,
    bIsRestricted: 0,
    RestrictedReason: "",
    IsBaseCountry: 0,
    bIsGreyList: null,
  },
  {
    CountryId: 78,
    CountryName: "INDIA",
    LRSCode: "IN",
    Nationality: "INDIAN",
    RiskCateg: "Low",
    LimitCategory: "Normal",
    Limits: 0.0,
    CTRCode: "91",
    bActive: 1,
    bIsRestricted: 1,
    RestrictedReason: "Base Country",
    IsBaseCountry: 1,
    bIsGreyList: null,
  },
  {
    CountryId: 119,
    CountryName: "MYANMAR",
    LRSCode: "MM",
    Nationality: "MYANMAR",
    RiskCateg: "HIGH",
    LimitCategory: "NORMAL",
    Limits: 3000.0,
    CTRCode: "95",
    bActive: 1,
    bIsRestricted: 1,
    RestrictedReason: "",
    IsBaseCountry: 0,
    bIsGreyList: null,
  },
];

export const LRS_COUNTRY_SAMPLES: SourceRow[] = [
  { CountryID: 1, CountryName: "AFGHANISTAN", CountryCode: "AF" },
  { CountryID: 2, CountryName: "ALBANIA", CountryCode: "AL" },
  { CountryID: 30, CountryName: "BRAZIL", CountryCode: "BR" },
  {
    CountryID: 31,
    CountryName: "BRITISH INDIAN OCEAN TERRITORY",
    CountryCode: "IO",
  },
  {
    CountryID: 32,
    CountryName: "BRITISH OVERSEAS TERRITORY",
    CountryCode: "1W",
  },
  { CountryID: 82, CountryName: "GERMANY (INCLUDES ECB)", CountryCode: "DE" },
  { CountryID: 83, CountryName: "GHANA", CountryCode: "GH" },
];

export const CTR_STATE_SAMPLES: SourceRow[] = [
  { STATENAME: "Andaman and Nicobar Islands", STATECODE: "AN" },
  { STATENAME: "Andhra Pradesh", STATECODE: "AP" },
  { STATENAME: "Arunachal Pradesh", STATECODE: "AR" },
  { STATENAME: "Assam", STATECODE: "AS" },
  { STATENAME: "Bihar", STATECODE: "BR" },
];

export const CTR_CUSTOMER_STATE_SAMPLES: SourceRow[] = [
  {
    CUSTOMERSTATEDESC: "Andaman and Nicobar Islands",
    CUSTOMERSTATEID: 1,
    CUSTOMERSTATEID2: "",
  },
  {
    CUSTOMERSTATEDESC: "Andhra Pradesh",
    CUSTOMERSTATEID: 2,
    CUSTOMERSTATEID2: 37,
  },
  {
    CUSTOMERSTATEDESC: "Arunachal Pradesh",
    CUSTOMERSTATEID: 3,
    CUSTOMERSTATEID2: 12,
  },
  { CUSTOMERSTATEDESC: "Assam", CUSTOMERSTATEID: 4, CUSTOMERSTATEID2: 18 },
  { CUSTOMERSTATEDESC: "Bihar", CUSTOMERSTATEID: 5, CUSTOMERSTATEID2: 10 },
  { CUSTOMERSTATEDESC: "Chandigarh", CUSTOMERSTATEID: 6, CUSTOMERSTATEID2: "04" },
  { CUSTOMERSTATEDESC: "Chhattisgarh", CUSTOMERSTATEID: 7, CUSTOMERSTATEID2: 22 },
  {
    CUSTOMERSTATEDESC: "Dadra and Nagar Haveli and Daman and Diu",
    CUSTOMERSTATEID: 8,
    CUSTOMERSTATEID2: "",
  },
  { CUSTOMERSTATEDESC: "Delhi", CUSTOMERSTATEID: 9, CUSTOMERSTATEID2: "07" },
  { CUSTOMERSTATEDESC: "Goa", CUSTOMERSTATEID: 10, CUSTOMERSTATEID2: 30 },
  { CUSTOMERSTATEDESC: "Gujarat", CUSTOMERSTATEID: 11, CUSTOMERSTATEID2: 24 },
];

export const GST_STATE_SAMPLES: SourceRow[] = [
  { "State code": "01", State: "JAMMU & KASHMIR" },
  { "State code": "02", State: "HIMACHAL PRADESH" },
  { "State code": "03", State: "PUNJAB" },
  { "State code": "04", State: "CHANDIGARH" },
  { "State code": "05", State: "UTTRANCHAL" },
  { "State code": "06", State: "HARYANA" },
  { "State code": "07", State: "DELHI" },
  { "State code": "08", State: "RAJASTHAN" },
  { "State code": "09", State: "UTTAR PRADESH" },
];

export const MST_LOCATION_TYPE_SAMPLES: SourceRow[] = [
  { LId: 1, LName: "City Location" },
  { LId: 2, LName: "Rural Location" },
  { LId: 3, LName: "Airport Location" },
];

export const CTR_CITY_SAMPLES: SourceRow[] = [
  { CITYNAME: "A Vellalapatti", CITYCODE: "6604" },
  { CITYNAME: "Aamby Valley", CITYCODE: "4943" },
  { CITYNAME: "Aamdi", CITYCODE: "3633" },
  { CITYNAME: "Abbanakuppe", CITYCODE: "7902" },
  { CITYNAME: "Abdu Rahiman Nagar", CITYCODE: "5794" },
  { CITYNAME: "Abhanpur", CITYCODE: "3620" },
];

export const CTR_CITY2_SAMPLES: SourceRow[] = [
  {
    CITYNAME: "A Vellalapatti",
    CITYCODE: "6604",
    STATECODE: "31",
    STATENAME: "Tamil Nadu",
    DISTRICTCODE: "666",
    DISTRICTNAME: "Madurai",
  },
  {
    CITYNAME: "Aamby Valley",
    CITYCODE: "4943",
    STATECODE: "21",
    STATENAME: "Maharashtra",
    DISTRICTCODE: "585",
    DISTRICTNAME: "Pune",
  },
  {
    CITYNAME: "Aamdi",
    CITYCODE: "3633",
    STATECODE: "7",
    STATENAME: "Chhattisgarh",
    DISTRICTCODE: "460",
    DISTRICTNAME: "Dhamtari",
  },
  {
    CITYNAME: "Abbanakuppe",
    CITYCODE: "7902",
    STATECODE: "16",
    STATENAME: "Karnataka",
    DISTRICTCODE: "626",
    DISTRICTNAME: "Ramanagara",
  },
  {
    CITYNAME: "Abdu Rahiman Nagar",
    CITYCODE: "5794",
    STATECODE: "17",
    STATENAME: "Kerala",
    DISTRICTCODE: "635",
    DISTRICTNAME: "Malappuram",
  },
];
