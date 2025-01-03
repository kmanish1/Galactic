const axios = require('axios').default;

const options = {
  method: 'GET',
  url: 'https://sandbox-api.okto.tech/api/v1/wallet',
  headers: {
    Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb2luZGN4X…4Njh9.Dn1dAdFV2jKL8wNo6HybcZgHtDIpsp2N-J4xlLrkASk'
  }
};

try {
  const { data } = await axios.request(options);
  console.log(data);
} catch (error) {
  console.error(error);
}