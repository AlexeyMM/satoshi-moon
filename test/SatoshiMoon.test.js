const NewContract = artifacts.require('SatoshiMoon');
const BigNumber = require('bignumber.js');

async function getTransactionCost(tx) {
    const gasPriceStr = await web3.eth.getGasPrice();
    const gasPrice = new BigNumber(gasPriceStr);
    return gasPrice.multipliedBy(tx.receipt.gasUsed);
}

const zeroAddress ='0x0000000000000000000000000000000000000000';

contract('SatoshiMoon', (accounts) => {
    const [
        deployer, admin1, admin2, investor1,
        investor2, investor3, investor4, investor5,
        investor6, investor7, investor8,
    ] = accounts;

    it('можно запустить в blockchain', () => {
        NewContract.deployed()
            .then(instance => instance != null)
    });

    it('можно отправить ETH контракту', async () => {
        const first = accounts[0];
        const amountToSend = web3.utils.toWei('1', "ether"); //convert to wei value
        const balance = await web3.eth.getBalance(first);
        const instance = await NewContract.deployed();
        const tx = await instance.send(amountToSend, {from: first});
        const txCost = await getTransactionCost(tx);
        const newBalance = await web3.eth.getBalance(first);
        let expectedAmount = new BigNumber(balance);
        expectedAmount = expectedAmount.minus(newBalance).minus(txCost);
        assert.equal(amountToSend, expectedAmount.toString());
    });

    it('должен изменяться список администраторов', async () => {
        const first = accounts[0];
        const amountToSend = web3.utils.toWei("1", "ether"); //convert to wei value
        const instance = await NewContract.deployed();
        const expectedAdmins = [admin1, admin2];
        await instance.setAdmins(...expectedAdmins);
        const admins = await instance.getAdmins.call();
        assert.deepEqual(
            admins, { '0': admin1, '1': admin2 },
            `Должны быть администраторы: ${expectedAdmins}, но получены: ${admins}`
        );
    });

    it('должен отправиться весь депозит 1 администратору если платеж от клиента без реферала и 2 администратора нет', async () => {
        const amountToSend = web3.utils.toWei("1", "ether"); //convert to wei value
        const instance = await NewContract.deployed();
        await instance.setAdmins(admin1, zeroAddress);
        const balance = await web3.eth.getBalance(admin1);
        await instance.send(amountToSend, {from: investor1});
        const newBalance = await web3.eth.getBalance(admin1);
        const expectedBalance = BigNumber.sum(balance, amountToSend);
        assert.isOk(
            expectedBalance.isEqualTo(newBalance),
            `Баланс должен быть: ${expectedBalance.toString()}, но получен: ${newBalance.toString()}`
        );
    });

    it('должен отправить процент от депозита в соотвествии с настройками по-умолчанию (50/50)', async () => {
        const amountToSend = web3.utils.toWei("1", "ether"); //convert to wei value
        const instance = await NewContract.deployed();
        await instance.setAdmins(admin1, admin2);
        const balanceAdmin1 = await web3.eth.getBalance(admin1);
        const balanceAdmin2 = await web3.eth.getBalance(admin2);
        await instance.send(amountToSend, {from: investor1});
        const newBalanceAdmin1 = await web3.eth.getBalance(admin1);
        const newBalanceAdmin2 = await web3.eth.getBalance(admin2);
        const halfOfSentAmount = (new BigNumber(amountToSend)).multipliedBy(0.5);
        const expectedBalanceAdmin1 = BigNumber.sum(balanceAdmin1, halfOfSentAmount);
        const expectedBalanceAdmin2 = BigNumber.sum(balanceAdmin2, halfOfSentAmount);
        assert.isOk(
            expectedBalanceAdmin1.isEqualTo(newBalanceAdmin1),
            `Expected balance: ${expectedBalanceAdmin1.toString()}, but actual: ${newBalanceAdmin1.toString()}`
        );
        assert.isOk(
            expectedBalanceAdmin2.isEqualTo(newBalanceAdmin2),
            `Expected balance: ${expectedBalanceAdmin2.toString()}, but actual: ${newBalanceAdmin2.toString()}`
        );
    });

    it('должен отправить процент от депозита в соотвествии с изменеными настройками (90/10)', async () => {
        const amountToSendStr = web3.utils.toWei("1", "ether"); //convert to wei value
        const instance = await NewContract.deployed();
        await instance.setAdmins(admin1, admin2);
        await instance.setAdminsPercent(90, 10);
        const balanceAdmin1 = await web3.eth.getBalance(admin1);
        const balanceAdmin2 = await web3.eth.getBalance(admin2);
        await instance.send(amountToSendStr, {from: investor1});
        const newBalanceAdmin1 = await web3.eth.getBalance(admin1);
        const newBalanceAdmin2 = await web3.eth.getBalance(admin2);
        const sentAmount = new BigNumber(amountToSendStr);
        const expectedBalanceAdmin1 = BigNumber.sum(balanceAdmin1, sentAmount.multipliedBy(0.9));
        const expectedBalanceAdmin2 = BigNumber.sum(balanceAdmin2, sentAmount.multipliedBy(0.1));
        assert.isOk(
            expectedBalanceAdmin1.isEqualTo(newBalanceAdmin1),
            `Expected balance: ${expectedBalanceAdmin1.toString()}, but actual: ${newBalanceAdmin1.toString()}`
        );
        assert.isOk(
            expectedBalanceAdmin2.isEqualTo(newBalanceAdmin2),
            `Expected balance: ${expectedBalanceAdmin2.toString()}, but actual: ${newBalanceAdmin2.toString()}`
        );
    });

    it(`должен отправить 20% от депозита первому рефералу, остальное отправить администратору #1 в соотвестии с настройками (100% от остатка)`, async () => {
        const amountToSend = web3.utils.toWei('1', "ether"); //convert to wei value
        const instance = await NewContract.deployed();
        await instance.setAdmins(admin1, zeroAddress);

        await web3.eth.sendTransaction({
            from: investor1, to: instance.address, value: amountToSend
        });

        const balance = await web3.eth.getBalance(investor1);
        const adminBalance = await web3.eth.getBalance(admin1);

        await web3.eth.sendTransaction({
            from: investor2, to: instance.address,
            data: investor1, value: amountToSend, gas: 200000
        });

        const sentAmount = new BigNumber(amountToSend);

        const expectedBalance = (new BigNumber(balance))
            .plus((new BigNumber(amountToSend)).div(5));
        const newBalance = await web3.eth.getBalance(investor1);
        assert.isOk(
            expectedBalance.isEqualTo(newBalance),
            `Expected balance: ${expectedBalance.toString()}, but actual: ${newBalance.toString()}`
        );

        const expectedAdminBalance = (new BigNumber(adminBalance))
            .plus(sentAmount.minus(sentAmount.div(5)));
        const newAdminBalance = await web3.eth.getBalance(admin1);
        assert.isOk(
            expectedAdminBalance.isEqualTo(newAdminBalance),
            `Expected admin balance: ${expectedAdminBalance.toString()}, but actual: ${newAdminBalance.toString()}`
        );
    });

    it(`должен отправить первому рефералу 20% от депозит, а остлальным 6 по 5%`, async () => {
        const amountToSend = web3.utils.toWei('1', "ether"); //convert to wei value
        const instance = await NewContract.deployed();
        await instance.setAdmins(admin1, admin2);
        // invest without refferer
        await web3.eth.sendTransaction({
            from: investor1, to: instance.address, value: amountToSend
        });

        //invset with refferer (20% payout)
        await web3.eth.sendTransaction({
            from: investor2, to: instance.address,
            data: investor1, value: amountToSend, gas: 200000
        });

        //invest with refferer (5% payout)
        const balanceInvestor1 = await web3.eth.getBalance(investor1);
        const balanceInvestor2 = await web3.eth.getBalance(investor2);

        await web3.eth.sendTransaction({
            from: investor3, to: instance.address,
            data: investor2, value: amountToSend, gas: 200000
        })

        const expectedBalanceInvestor1 = (new BigNumber(balanceInvestor1))
            .plus((new BigNumber(amountToSend)).div(20));

        const expectedBalanceInvestor2 = (new BigNumber(balanceInvestor2))
            .plus((new BigNumber(amountToSend)).div(5));

        const newBalanceInvestor1 = await web3.eth.getBalance(investor1);
        const newBalanceInvestor2 = await web3.eth.getBalance(investor2);

        assert.isOk(
            expectedBalanceInvestor1.isEqualTo(newBalanceInvestor1),
            `Expected balance: ${expectedBalanceInvestor1.toString()},
          but actual: ${newBalanceInvestor1.toString()}`
        );

        assert.isOk(
            expectedBalanceInvestor2.isEqualTo(newBalanceInvestor2),
            `Expected balance: ${expectedBalanceInvestor2.toString()},
          but actual: ${newBalanceInvestor2.toString()}`
        );
    });
});
