import * as  bodyParser from 'body-parser';
import * as express from 'express';
import * as cors from 'cors';
import * as _ from 'lodash';
import {
    Block, generateNextBlock, generatenextBlockWithTransaction, generateRawNextBlock, getAccountBalance,
    getBlockchain, getMyUnspentTransactionOutputs, getUnspentTxOuts, sendTransaction,
    generatenextBlockWithTransactionAdmin, sendTransactionAdmin
} from './blockchain';
import {connectToPeers, getSockets, initP2PServer} from './p2p';
import {getPublicKey, UnspentTxOut} from './transaction';
import {getTransactionPool} from './transactionPool';
import {getPublicFromWallet, initWallet , generatePrivateKey } from './wallet';

const httpPort: number = parseInt(process.env.PORT) || 3001;
const p2pPort: number = parseInt(process.env.PORT) || 6001;
// const httpPort: number = parseInt(process.env.HTTP_PORT);
// const p2pPort: number = parseInt(process.env.P2P_PORT);

const initHttpServer = (myHttpPort: number) => {
    const app = express();
    app.use(cors());

    app.use(bodyParser.json());

    app.use((err, req, res, next) => {
        if (err) {
            res.status(400).send(err.message);
        }
    });

    app.get('/blocks', (req, res, next) => {
        res.json(getBlockchain());
    });

    app.get('/block/:hash', (req, res, next) => {
        const block = _.find(getBlockchain(), {'hash' : req.params.hash});
        res.json(block);
    });

    app.get('/transaction/:id', (req, res, next) => {
        const tx = _(getBlockchain())
            .map((blocks) => blocks.data)
            .flatten()
            .find({'id': req.params.id});
        res.json(tx);
    });

    app.get('/address/:address', (req, res, next) => {
        const unspentTxOuts: UnspentTxOut[] =
            _.filter(getUnspentTxOuts(), (uTxO) => uTxO.address === req.params.address);
        res.json({'unspentTxOuts': unspentTxOuts});
    });

    app.get('/unspentTransactionOutputs', (req, res) => {
        res.send(getUnspentTxOuts());
    });

    app.get('/myUnspentTransactionOutputs', (req, res) => {
        res.send(getMyUnspentTransactionOutputs());
    });

    app.post('/mineRawBlock', (req, res) => {
        if (req.body.data == null) {
            res.send('data parameter is missing');
            return;
        }
        const newBlock: Block = generateRawNextBlock(req.body.data);
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        } else {
            res.send(newBlock);
        }
    });

    app.post('/mineBlock', (req, res) => {
        const newBlock: Block = generateNextBlock();
        if (newBlock === null) {
            res.status(400).send('could not generate block');
        } else {
            res.send(newBlock);
        }
    });

    app.get('/balance/:address', (req, res, next) => {
        const balance: number = getAccountBalance(req.params.address);
        res.json({'balance': balance});
    });

    app.get('/address', (req, res, next) => {
        const address: string = getPublicFromWallet();
        res.json({'address': address});
    });

    // MY
    app.get('/keypair', (req, res, next) => {
        const privateKey: string = generatePrivateKey();
        const publicKey: string = getPublicKey(privateKey);
        res.json({'privateKey': privateKey, 'publicKey': publicKey});
    });

    app.post('/mineTransaction', (req, res) => {
        const toAddress = req.body.toAddress;
        const amount = req.body.amount;
        const privateKey = req.body.privateKey;
        try {
            const resp = generatenextBlockWithTransaction(toAddress, amount, privateKey);
            res.send(resp);
        } catch (e) {
            console.log(e.message);
            res.status(400).send(e.message);
        }
    });
// ----------------------------------------------------------------
    app.post('/mineTransactionAdmin', (req, res) => {
        const address = req.body.address;
        const amount = req.body.amount;
        try {
            const resp = generatenextBlockWithTransactionAdmin(address, amount);
            res.send(resp);
        } catch (e) {
            console.log(e.message);
            res.status(400).send(e.message);
        }
    });
// ----------------------------------------------------------------
    app.post('/sendTransaction', (req, res) => {
        try {
            const privateKey = req.body.privateKey;
            const toAddress = req.body.toAddress;
            const amount = req.body.amount;

            if (toAddress === undefined || amount === undefined || privateKey === undefined) {
                throw Error('invalid addresses or amount');
            }
            const resp = sendTransaction(toAddress, amount, privateKey);
            res.send(resp);
        } catch (e) {
            console.log(e.message);
            res.status(400).send(e.message);
        }
    });

// ----------------------------------------------------------------
    app.post('/sendTransactionAdmin', (req, res) => {
        try {
            const address = req.body.address;
            const amount = req.body.amount;

            if (address === undefined || amount === undefined) {
                throw Error('invalid address or amount');
            }
            const resp = sendTransactionAdmin(address, amount);
            res.send(resp);
        } catch (e) {
            console.log(e.message);
            res.status(400).send(e.message);
        }
    });
// ----------------------------------------------------------------

    app.get('/transactionPool', (req, res, next) => {
        res.json(getTransactionPool());
    });

    app.get('/peers', (req, res) => {
        res.send(getSockets().map((s: any) => s._socket.remoteAddress + ':' + s._socket.remotePort));
    });
    app.post('/addPeer', (req, res) => {
        connectToPeers(req.body.peer);
        res.send();
    });

    app.post('/stop', (req, res) => {
        res.send({'msg' : 'stopping server'});
        process.exit();
    });

    app.listen(myHttpPort, () => {
        console.log('Listening http on port: ' + myHttpPort);
    });
};

initHttpServer(httpPort);
initP2PServer(p2pPort);
initWallet();
