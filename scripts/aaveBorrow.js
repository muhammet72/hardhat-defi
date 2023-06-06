const { getNamedAccounts, ethers } = require("hardhat")
const { getWeth, AMOUNT } = require("../scripts/getWeth")

async function main() {
  // the protocol treats evry thins as a ERC20 token
  const { deployer } = await getNamedAccounts()
  // abi, address
  await getWeth()

  // Lending pool provider address = 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5
  // Lending pool = ^
  const lendingPool = await getLendingPool(deployer)
  console.log(`LendingPool Address ${lendingPool.address}`)
  // deposite
  const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
  // approve
  await approveERC20(wethTokenAddress, lendingPool.address, AMOUNT, deployer)
  console.log("Depositing ...")

  await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0)
  console.log("Deposited")

  let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(lendingPool, deployer)

  const daiPrice = await getDaiPrice()
  const amountDaiToBorrow = availableBorrowsETH.toString() * 0.95 * (1 / daiPrice.toNumber())
  console.log(`You can borrow ${amountDaiToBorrow} DAI`)
  const amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiToBorrow.toString())

  // Borrow Time!
  // How much we have Borrow, how much we have in collateral , how muc we can borrow
  const daiTokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
  await borrowDai(daiTokenAddress, lendingPool, amountDaiToBorrowWei, deployer)

  await getBorrowUserData(lendingPool, deployer)
  await repay(amountDaiToBorrowWei, daiTokenAddress, lendingPool, deployer)
  await getBorrowUserData(lendingPool, deployer)
}

async function repay(amount, daiAddress, lendingPool, account) {
  await approveERC20(daiAddress, lendingPool.address, amount, account)
  const repayTx = await lendingPool.repay(daiAddress, amount, 1, account)
  await repayTx.wait(1)
  console.log("repayed.")
}

async function borrowDai(daiAddress, lendingPool, amountDaiToBorrowWei, account) {
  const borrowTx = await lendingPool.borrow(daiAddress, amountDaiToBorrowWei, 1, 0, account)
  await borrowTx.wait(1)
  console.log("You've Borrowed ...")
}

async function getDaiPrice() {
  const daiEthPriceFeed = await ethers.getContractAt(
    "AggregatorV3Interface",
    "0x773616e4d11a78f511299002da57a0a94577f1f4"
  )
  const price = (await daiEthPriceFeed.latestRoundData())[1]
  console.log(`The DIA/ETH price is  ${price.toString()}`)
  return price
}

async function getBorrowUserData(lendingPool, account) {
  const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
    await lendingPool.getUserAccountData(account)
  console.log(`you have ${totalCollateralETH} worth of ETH deposited.`)
  console.log(`you have ${totalDebtETH} worth of ETH Borrowed.`)
  console.log(`you have ${availableBorrowsETH} worth of ETH .`)
  return { availableBorrowsETH, totalDebtETH }
}

async function getLendingPool(account) {
  const lendingPoolAddressesProvider = await ethers.getContractAt(
    "ILendingPoolAddressesProvider",
    "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5",
    account
  )
  const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()
  const lendingPool = await ethers.getContractAt("ILendingPool", lendingPoolAddress, account)
  //lendingPool.address = lendingPoolAddress
  return lendingPool
}

async function approveERC20(erc20Address, spenderAddress, amountToSpend, account) {
  const erc20Token = await ethers.getContractAt("IERC20", erc20Address, account)
  const tx = await erc20Token.approve(spenderAddress, amountToSpend)
  await tx.wait(1)
  console.log("approved")
}

main()
  .then(() => process.exit())
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
