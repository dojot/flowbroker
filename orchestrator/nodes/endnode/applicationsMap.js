const Parser = require("binary-parser").Parser;
//Documentação https://github.com/keichi/binary-parser

module.exports = {
    
    //Ônibus Circular
    "01" : new Parser().uint8("Aplicacao").uint32be('Timestamp').uint16be('QuantidadePassageiros').uint32be('TotalPassageirosMomento').floatbe('Latitude').floatbe('Longitude').floatbe('TemperaturaInterna'),

    //Barco Elétrico
    "02" : new Parser().uint8("Aplicacao").uint32be('Timestamp').uint16be('QuantidadePassageiros').uint32be('TotalPassageirosMomento').floatbe('Latitude').floatbe('Longitude').floatbe('TemperaturaInterna'),

    //Sistema Fotovoltaico (UACT 3F)
    "03" : new Parser().uint8("Aplicacao").uint32be('Timestamp').floatbe('TensaoRMSFaseA').floatbe('TensaoRMSFaseB').floatbe('TensaoRMSFaseC').floatbe('CorrenteRMSFaseA').floatbe('CorrenteRMSFaseB').floatbe('CorrenteRMSFaseC').floatbe('CorrenteRMSneutro').floatbe('FrequenciaFaseA').floatbe('FrequenciaFaseB').floatbe('FrequenciaFaseC').floatbe('PotenciaAtivaFaseA').floatbe('PotenciaAtivaFaseB').floatbe('PotenciaAtivaFaseC').floatbe('PotenciaAtivaTotal').floatbe('PotenciaReativaFaseA').floatbe('PotenciaReativaFaseB').floatbe('PotenciaReativaFaseC').floatbe('PotenciaReativaTotal').floatbe('PotenciaAparenteFaseA').floatbe('PotenciaAparenteFaseB').floatbe('PotenciaAparenteFaseC').floatbe('PotenciaAparenteTotal').floatbe('FatordePotenciaFaseA').floatbe('FatordePotenciaFaseB').floatbe('FatordePotenciaFaseC').floatbe('FatordePotenciaTotal').floatbe('ConsumoFaseA').floatbe('ConsumoFaseB').floatbe('ConsumoFaseC').floatbe('ConsumoTotal'),

    //Sistema de Baterias (UACT CC)
    "04" : new Parser().uint8("Aplicacao").uint32be('Timestamp').floatbe('TensaoCC').floatbe('CorrenteCC1').floatbe('CorrenteCC2').floatbe('CorrenteCC3').floatbe('CorrenteCC4').floatbe('CorrenteCC5').floatbe('CorrenteCC6').floatbe('CorrenteCC7').floatbe('CorrenteCC8').floatbe('PotenciaCC').floatbe('EnergiaFornecida').floatbe('EnergiaConsumida'),

    //Eletroposto Ceamazon (UACT 3F)
    "05" : new Parser().uint8("Aplicacao").uint32be('Timestamp').floatbe('TensaoRMSFaseA').floatbe('TensaoRMSFaseB').floatbe('TensaoRMSFaseC').floatbe('CorrenteRMSFaseA').floatbe('CorrenteRMSFaseB').floatbe('CorrenteRMSFaseC').floatbe('CorrenteRMSneutro').floatbe('FrequenciaFaseA').floatbe('FrequenciaFaseB').floatbe('FrequenciaFaseC').floatbe('PotenciaAtivaFaseA').floatbe('PotenciaAtivaFaseB').floatbe('PotenciaAtivaFaseC').floatbe('PotenciaAtivaTotal').floatbe('PotenciaReativaFaseA').floatbe('PotenciaReativaFaseB').floatbe('PotenciaReativaFaseC').floatbe('PotenciaReativaTotal').floatbe('PotenciaAparenteFaseA').floatbe('PotenciaAparenteFaseB').floatbe('PotenciaAparenteFaseC').floatbe('PotenciaAparenteTotal').floatbe('FatordePotenciaFaseA').floatbe('FatordePotenciaFaseB').floatbe('FatordePotenciaFaseC').floatbe('FatordePotenciaTotal').floatbe('ConsumoFaseA').floatbe('ConsumoFaseB').floatbe('ConsumoFaseC').floatbe('ConsumoTotal'),

    //Eletroposto Ginásio ABB (UACT C)
    "06" : new Parser().uint8("Aplicacao").uint32be('Timestamp').floatbe('TensaoCC').floatbe('CorrenteCC').floatbe('PotenciaCC').floatbe('EnergiaFornecida').floatbe('EnergiaConsumida'),

    //Harmônico Individual de Tensão A
    "F1" : new Parser().uint8("Aplicacao").floatbe('HITensaoFaseA1').floatbe('HITensaoFaseA2').floatbe('HITensaoFaseA3').floatbe('HITensaoFaseA4').floatbe('HITensaoFaseA5').floatbe('HITensaoFaseA6').floatbe('HITensaoFaseA7').floatbe('HITensaoFaseA8').floatbe('HITensaoFaseA9').floatbe('HITensaoFaseA10').floatbe('HITensaoFaseA11').floatbe('HITensaoFaseA12').floatbe('HITensaoFaseA13').floatbe('HITensaoFaseA14').floatbe('HITensaoFaseA15').floatbe('HITensaoFaseA16').floatbe('HITensaoFaseA17').floatbe('HITensaoFaseA18').floatbe('HITensaoFaseA19').floatbe('HITensaoFaseA20').floatbe('HITensaoFaseA21').floatbe('HITensaoFaseA22').floatbe('HITensaoFaseA23').floatbe('HITensaoFaseA24').floatbe('HITensaoFaseA25').floatbe('HITensaoFaseA26').floatbe('HITensaoFaseA27').floatbe('HITensaoFaseA28').floatbe('HITensaoFaseA29').floatbe('HITensaoFaseA30').floatbe('HITensaoFaseA31').floatbe('HITensaoFaseA32').floatbe('HITensaoFaseA33').floatbe('HITensaoFaseA34').floatbe('HITensaoFaseA35').floatbe('HITensaoFaseA36').floatbe('HITensaoFaseA37').floatbe('HITensaoFaseA38').floatbe('HITensaoFaseA39').floatbe('HITensaoFaseA40').floatbe('HITensaoFaseA41').floatbe('HITensaoFaseA42').floatbe('HITensaoFaseA43').floatbe('HITensaoFaseA44').floatbe('HITensaoFaseA45').floatbe('HITensaoFaseA46').floatbe('HITensaoFaseA47').floatbe('HITensaoFaseA48').floatbe('HITensaoFaseA49').floatbe('HTTensaoFaseA'),

    //Harmônico Individual de Tensão B
    "F2" : new Parser().uint8("Aplicacao").floatbe('HITensaoFaseB1').floatbe('HITensaoFaseB2').floatbe('HITensaoFaseB3').floatbe('HITensaoFaseB4').floatbe('HITensaoFaseB5').floatbe('HITensaoFaseB6').floatbe('HITensaoFaseB7').floatbe('HITensaoFaseB8').floatbe('HITensaoFaseB9').floatbe('HITensaoFaseB10').floatbe('HITensaoFaseB11').floatbe('HITensaoFaseB12').floatbe('HITensaoFaseB13').floatbe('HITensaoFaseB14').floatbe('HITensaoFaseB15').floatbe('HITensaoFaseB16').floatbe('HITensaoFaseB17').floatbe('HITensaoFaseB18').floatbe('HITensaoFaseB19').floatbe('HITensaoFaseB20').floatbe('HITensaoFaseB21').floatbe('HITensaoFaseB22').floatbe('HITensaoFaseB23').floatbe('HITensaoFaseB24').floatbe('HITensaoFaseB25').floatbe('HITensaoFaseB26').floatbe('HITensaoFaseB27').floatbe('HITensaoFaseB28').floatbe('HITensaoFaseB29').floatbe('HITensaoFaseB30').floatbe('HITensaoFaseB31').floatbe('HITensaoFaseB32').floatbe('HITensaoFaseB33').floatbe('HITensaoFaseB34').floatbe('HITensaoFaseB35').floatbe('HITensaoFaseB36').floatbe('HITensaoFaseB37').floatbe('HITensaoFaseB38').floatbe('HITensaoFaseB39').floatbe('HITensaoFaseB40').floatbe('HITensaoFaseB41').floatbe('HITensaoFaseB42').floatbe('HITensaoFaseB43').floatbe('HITensaoFaseB44').floatbe('HITensaoFaseB45').floatbe('HITensaoFaseB46').floatbe('HITensaoFaseB47').floatbe('HITensaoFaseB48').floatbe('HITensaoFaseB49').floatbe('HTTensaoFaseB'),

    //Harmônico Individual de Tensão C
    "F3" : new Parser().uint8("Aplicacao").floatbe('HITensaoFaseC1').floatbe('HITensaoFaseC2').floatbe('HITensaoFaseC3').floatbe('HITensaoFaseC4').floatbe('HITensaoFaseC5').floatbe('HITensaoFaseC6').floatbe('HITensaoFaseC7').floatbe('HITensaoFaseC8').floatbe('HITensaoFaseC9').floatbe('HITensaoFaseC10').floatbe('HITensaoFaseC11').floatbe('HITensaoFaseC12').floatbe('HITensaoFaseC13').floatbe('HITensaoFaseC14').floatbe('HITensaoFaseC15').floatbe('HITensaoFaseC16').floatbe('HITensaoFaseC17').floatbe('HITensaoFaseC18').floatbe('HITensaoFaseC19').floatbe('HITensaoFaseC20').floatbe('HITensaoFaseC21').floatbe('HITensaoFaseC22').floatbe('HITensaoFaseC23').floatbe('HITensaoFaseC24').floatbe('HITensaoFaseC25').floatbe('HITensaoFaseC26').floatbe('HITensaoFaseC27').floatbe('HITensaoFaseC28').floatbe('HITensaoFaseC29').floatbe('HITensaoFaseC30').floatbe('HITensaoFaseC31').floatbe('HITensaoFaseC32').floatbe('HITensaoFaseC33').floatbe('HITensaoFaseC34').floatbe('HITensaoFaseC35').floatbe('HITensaoFaseC36').floatbe('HITensaoFaseC37').floatbe('HITensaoFaseC38').floatbe('HITensaoFaseC39').floatbe('HITensaoFaseC40').floatbe('HITensaoFaseC41').floatbe('HITensaoFaseC42').floatbe('HITensaoFaseC43').floatbe('HITensaoFaseC44').floatbe('HITensaoFaseC45').floatbe('HITensaoFaseC46').floatbe('HITensaoFaseC47').floatbe('HITensaoFaseC48').floatbe('HITensaoFaseC49').floatbe('HTTensaoFaseC'),

    //Harmônico Individual de Corrente A
    "F4" : new Parser().uint8("Aplicacao").floatbe('HICorrenteFaseA1').floatbe('HICorrenteFaseA2').floatbe('HICorrenteFaseA3').floatbe('HICorrenteFaseA4').floatbe('HICorrenteFaseA5').floatbe('HICorrenteFaseA6').floatbe('HICorrenteFaseA7').floatbe('HICorrenteFaseA8').floatbe('HICorrenteFaseA9').floatbe('HICorrenteFaseA10').floatbe('HICorrenteFaseA11').floatbe('HICorrenteFaseA12').floatbe('HICorrenteFaseA13').floatbe('HICorrenteFaseA14').floatbe('HICorrenteFaseA15').floatbe('HICorrenteFaseA16').floatbe('HICorrenteFaseA17').floatbe('HICorrenteFaseA18').floatbe('HICorrenteFaseA19').floatbe('HICorrenteFaseA20').floatbe('HICorrenteFaseA21').floatbe('HICorrenteFaseA22').floatbe('HICorrenteFaseA23').floatbe('HICorrenteFaseA24').floatbe('HICorrenteFaseA25').floatbe('HICorrenteFaseA26').floatbe('HICorrenteFaseA27').floatbe('HICorrenteFaseA28').floatbe('HICorrenteFaseA29').floatbe('HICorrenteFaseA30').floatbe('HICorrenteFaseA31').floatbe('HICorrenteFaseA32').floatbe('HICorrenteFaseA33').floatbe('HICorrenteFaseA34').floatbe('HICorrenteFaseA35').floatbe('HICorrenteFaseA36').floatbe('HICorrenteFaseA37').floatbe('HICorrenteFaseA38').floatbe('HICorrenteFaseA39').floatbe('HICorrenteFaseA40').floatbe('HICorrenteFaseA41').floatbe('HICorrenteFaseA42').floatbe('HICorrenteFaseA43').floatbe('HICorrenteFaseA44').floatbe('HICorrenteFaseA45').floatbe('HICorrenteFaseA46').floatbe('HICorrenteFaseA47').floatbe('HICorrenteFaseA48').floatbe('HICorrenteFaseA49').floatbe('HTCorrenteFaseA'),

    //Harmônico Individual de Corrente B
    "F5" : new Parser().uint8("Aplicacao").floatbe('HICorrenteFaseB1').floatbe('HICorrenteFaseB2').floatbe('HICorrenteFaseB3').floatbe('HICorrenteFaseB4').floatbe('HICorrenteFaseB5').floatbe('HICorrenteFaseB6').floatbe('HICorrenteFaseB7').floatbe('HICorrenteFaseB8').floatbe('HICorrenteFaseB9').floatbe('HICorrenteFaseB10').floatbe('HICorrenteFaseB11').floatbe('HICorrenteFaseB12').floatbe('HICorrenteFaseB13').floatbe('HICorrenteFaseB14').floatbe('HICorrenteFaseB15').floatbe('HICorrenteFaseB16').floatbe('HICorrenteFaseB17').floatbe('HICorrenteFaseB18').floatbe('HICorrenteFaseB19').floatbe('HICorrenteFaseB20').floatbe('HICorrenteFaseB21').floatbe('HICorrenteFaseB22').floatbe('HICorrenteFaseB23').floatbe('HICorrenteFaseB24').floatbe('HICorrenteFaseB25').floatbe('HICorrenteFaseB26').floatbe('HICorrenteFaseB27').floatbe('HICorrenteFaseB28').floatbe('HICorrenteFaseB29').floatbe('HICorrenteFaseB30').floatbe('HICorrenteFaseB31').floatbe('HICorrenteFaseB32').floatbe('HICorrenteFaseB33').floatbe('HICorrenteFaseB34').floatbe('HICorrenteFaseB35').floatbe('HICorrenteFaseB36').floatbe('HICorrenteFaseB37').floatbe('HICorrenteFaseB38').floatbe('HICorrenteFaseB39').floatbe('HICorrenteFaseB40').floatbe('HICorrenteFaseB41').floatbe('HICorrenteFaseB42').floatbe('HICorrenteFaseB43').floatbe('HICorrenteFaseB44').floatbe('HICorrenteFaseB45').floatbe('HICorrenteFaseB46').floatbe('HICorrenteFaseB47').floatbe('HICorrenteFaseB48').floatbe('HICorrenteFaseB49').floatbe('HTCorrenteFaseB'),

    //Harmônico Individual de Corrente C
    "F6" : new Parser().uint8("Aplicacao").floatbe('HICorrenteFaseC1').floatbe('HICorrenteFaseC2').floatbe('HICorrenteFaseC3').floatbe('HICorrenteFaseC4').floatbe('HICorrenteFaseC5').floatbe('HICorrenteFaseC6').floatbe('HICorrenteFaseC7').floatbe('HICorrenteFaseC8').floatbe('HICorrenteFaseC9').floatbe('HICorrenteFaseC10').floatbe('HICorrenteFaseC11').floatbe('HICorrenteFaseC12').floatbe('HICorrenteFaseC13').floatbe('HICorrenteFaseC14').floatbe('HICorrenteFaseC15').floatbe('HICorrenteFaseC16').floatbe('HICorrenteFaseC17').floatbe('HICorrenteFaseC18').floatbe('HICorrenteFaseC19').floatbe('HICorrenteFaseC20').floatbe('HICorrenteFaseC21').floatbe('HICorrenteFaseC22').floatbe('HICorrenteFaseC23').floatbe('HICorrenteFaseC24').floatbe('HICorrenteFaseC25').floatbe('HICorrenteFaseC26').floatbe('HICorrenteFaseC27').floatbe('HICorrenteFaseC28').floatbe('HICorrenteFaseC29').floatbe('HICorrenteFaseC30').floatbe('HICorrenteFaseC31').floatbe('HICorrenteFaseC32').floatbe('HICorrenteFaseC33').floatbe('HICorrenteFaseC34').floatbe('HICorrenteFaseC35').floatbe('HICorrenteFaseC36').floatbe('HICorrenteFaseC37').floatbe('HICorrenteFaseC38').floatbe('HICorrenteFaseC39').floatbe('HICorrenteFaseC40').floatbe('HICorrenteFaseC41').floatbe('HICorrenteFaseC42').floatbe('HICorrenteFaseC43').floatbe('HICorrenteFaseC44').floatbe('HICorrenteFaseC45').floatbe('HICorrenteFaseC46').floatbe('HICorrenteFaseC47').floatbe('HICorrenteFaseC48').floatbe('HICorrenteFaseC49').floatbe('HTCorrenteFaseC'),

    //Harmônico Individual de Tensão A
    "F7" : new Parser().uint8("Aplicacao").floatbe('HITensaoFaseA1').floatbe('HITensaoFaseA2').floatbe('HITensaoFaseA3').floatbe('HITensaoFaseA4').floatbe('HITensaoFaseA5').floatbe('HITensaoFaseA6').floatbe('HITensaoFaseA7').floatbe('HITensaoFaseA8').floatbe('HITensaoFaseA9').floatbe('HITensaoFaseA10').floatbe('HITensaoFaseA11').floatbe('HITensaoFaseA12').floatbe('HITensaoFaseA13').floatbe('HITensaoFaseA14').floatbe('HITensaoFaseA15').floatbe('HITensaoFaseA16').floatbe('HITensaoFaseA17').floatbe('HITensaoFaseA18').floatbe('HITensaoFaseA19').floatbe('HITensaoFaseA20').floatbe('HITensaoFaseA21').floatbe('HITensaoFaseA22').floatbe('HITensaoFaseA23').floatbe('HITensaoFaseA24').floatbe('HITensaoFaseA25').floatbe('HITensaoFaseA26').floatbe('HITensaoFaseA27').floatbe('HITensaoFaseA28').floatbe('HITensaoFaseA29').floatbe('HITensaoFaseA30').floatbe('HITensaoFaseA31').floatbe('HITensaoFaseA32').floatbe('HITensaoFaseA33').floatbe('HITensaoFaseA34').floatbe('HITensaoFaseA35').floatbe('HITensaoFaseA36').floatbe('HITensaoFaseA37').floatbe('HITensaoFaseA38').floatbe('HITensaoFaseA39').floatbe('HITensaoFaseA40').floatbe('HITensaoFaseA41').floatbe('HITensaoFaseA42').floatbe('HITensaoFaseA43').floatbe('HITensaoFaseA44').floatbe('HITensaoFaseA45').floatbe('HITensaoFaseA46').floatbe('HITensaoFaseA47').floatbe('HITensaoFaseA48').floatbe('HITensaoFaseA49').floatbe('HTTensaoFaseA'),

    //Harmônico Individual de Tensão B
    "F8" : new Parser().uint8("Aplicacao").floatbe('HITensaoFaseB1').floatbe('HITensaoFaseB2').floatbe('HITensaoFaseB3').floatbe('HITensaoFaseB4').floatbe('HITensaoFaseB5').floatbe('HITensaoFaseB6').floatbe('HITensaoFaseB7').floatbe('HITensaoFaseB8').floatbe('HITensaoFaseB9').floatbe('HITensaoFaseB10').floatbe('HITensaoFaseB11').floatbe('HITensaoFaseB12').floatbe('HITensaoFaseB13').floatbe('HITensaoFaseB14').floatbe('HITensaoFaseB15').floatbe('HITensaoFaseB16').floatbe('HITensaoFaseB17').floatbe('HITensaoFaseB18').floatbe('HITensaoFaseB19').floatbe('HITensaoFaseB20').floatbe('HITensaoFaseB21').floatbe('HITensaoFaseB22').floatbe('HITensaoFaseB23').floatbe('HITensaoFaseB24').floatbe('HITensaoFaseB25').floatbe('HITensaoFaseB26').floatbe('HITensaoFaseB27').floatbe('HITensaoFaseB28').floatbe('HITensaoFaseB29').floatbe('HITensaoFaseB30').floatbe('HITensaoFaseB31').floatbe('HITensaoFaseB32').floatbe('HITensaoFaseB33').floatbe('HITensaoFaseB34').floatbe('HITensaoFaseB35').floatbe('HITensaoFaseB36').floatbe('HITensaoFaseB37').floatbe('HITensaoFaseB38').floatbe('HITensaoFaseB39').floatbe('HITensaoFaseB40').floatbe('HITensaoFaseB41').floatbe('HITensaoFaseB42').floatbe('HITensaoFaseB43').floatbe('HITensaoFaseB44').floatbe('HITensaoFaseB45').floatbe('HITensaoFaseB46').floatbe('HITensaoFaseB47').floatbe('HITensaoFaseB48').floatbe('HITensaoFaseB49').floatbe('HTTensaoFaseB'),

    //Harmônico Individual de Tensão C
    "F9" : new Parser().uint8("Aplicacao").floatbe('HITensaoFaseC1').floatbe('HITensaoFaseC2').floatbe('HITensaoFaseC3').floatbe('HITensaoFaseC4').floatbe('HITensaoFaseC5').floatbe('HITensaoFaseC6').floatbe('HITensaoFaseC7').floatbe('HITensaoFaseC8').floatbe('HITensaoFaseC9').floatbe('HITensaoFaseC10').floatbe('HITensaoFaseC11').floatbe('HITensaoFaseC12').floatbe('HITensaoFaseC13').floatbe('HITensaoFaseC14').floatbe('HITensaoFaseC15').floatbe('HITensaoFaseC16').floatbe('HITensaoFaseC17').floatbe('HITensaoFaseC18').floatbe('HITensaoFaseC19').floatbe('HITensaoFaseC20').floatbe('HITensaoFaseC21').floatbe('HITensaoFaseC22').floatbe('HITensaoFaseC23').floatbe('HITensaoFaseC24').floatbe('HITensaoFaseC25').floatbe('HITensaoFaseC26').floatbe('HITensaoFaseC27').floatbe('HITensaoFaseC28').floatbe('HITensaoFaseC29').floatbe('HITensaoFaseC30').floatbe('HITensaoFaseC31').floatbe('HITensaoFaseC32').floatbe('HITensaoFaseC33').floatbe('HITensaoFaseC34').floatbe('HITensaoFaseC35').floatbe('HITensaoFaseC36').floatbe('HITensaoFaseC37').floatbe('HITensaoFaseC38').floatbe('HITensaoFaseC39').floatbe('HITensaoFaseC40').floatbe('HITensaoFaseC41').floatbe('HITensaoFaseC42').floatbe('HITensaoFaseC43').floatbe('HITensaoFaseC44').floatbe('HITensaoFaseC45').floatbe('HITensaoFaseC46').floatbe('HITensaoFaseC47').floatbe('HITensaoFaseC48').floatbe('HITensaoFaseC49').floatbe('HTTensaoFaseC'),

    //Harmônico Individual de Corrente A
    "FA" : new Parser().uint8("Aplicacao").floatbe('HICorrenteFaseA1').floatbe('HICorrenteFaseA2').floatbe('HICorrenteFaseA3').floatbe('HICorrenteFaseA4').floatbe('HICorrenteFaseA5').floatbe('HICorrenteFaseA6').floatbe('HICorrenteFaseA7').floatbe('HICorrenteFaseA8').floatbe('HICorrenteFaseA9').floatbe('HICorrenteFaseA10').floatbe('HICorrenteFaseA11').floatbe('HICorrenteFaseA12').floatbe('HICorrenteFaseA13').floatbe('HICorrenteFaseA14').floatbe('HICorrenteFaseA15').floatbe('HICorrenteFaseA16').floatbe('HICorrenteFaseA17').floatbe('HICorrenteFaseA18').floatbe('HICorrenteFaseA19').floatbe('HICorrenteFaseA20').floatbe('HICorrenteFaseA21').floatbe('HICorrenteFaseA22').floatbe('HICorrenteFaseA23').floatbe('HICorrenteFaseA24').floatbe('HICorrenteFaseA25').floatbe('HICorrenteFaseA26').floatbe('HICorrenteFaseA27').floatbe('HICorrenteFaseA28').floatbe('HICorrenteFaseA29').floatbe('HICorrenteFaseA30').floatbe('HICorrenteFaseA31').floatbe('HICorrenteFaseA32').floatbe('HICorrenteFaseA33').floatbe('HICorrenteFaseA34').floatbe('HICorrenteFaseA35').floatbe('HICorrenteFaseA36').floatbe('HICorrenteFaseA37').floatbe('HICorrenteFaseA38').floatbe('HICorrenteFaseA39').floatbe('HICorrenteFaseA40').floatbe('HICorrenteFaseA41').floatbe('HICorrenteFaseA42').floatbe('HICorrenteFaseA43').floatbe('HICorrenteFaseA44').floatbe('HICorrenteFaseA45').floatbe('HICorrenteFaseA46').floatbe('HICorrenteFaseA47').floatbe('HICorrenteFaseA48').floatbe('HICorrenteFaseA49').floatbe('HTCorrenteFaseA'),

    //Harmônico Individual de Corrente B
    "FB" : new Parser().uint8("Aplicacao").floatbe('HICorrenteFaseB1').floatbe('HICorrenteFaseB2').floatbe('HICorrenteFaseB3').floatbe('HICorrenteFaseB4').floatbe('HICorrenteFaseB5').floatbe('HICorrenteFaseB6').floatbe('HICorrenteFaseB7').floatbe('HICorrenteFaseB8').floatbe('HICorrenteFaseB9').floatbe('HICorrenteFaseB10').floatbe('HICorrenteFaseB11').floatbe('HICorrenteFaseB12').floatbe('HICorrenteFaseB13').floatbe('HICorrenteFaseB14').floatbe('HICorrenteFaseB15').floatbe('HICorrenteFaseB16').floatbe('HICorrenteFaseB17').floatbe('HICorrenteFaseB18').floatbe('HICorrenteFaseB19').floatbe('HICorrenteFaseB20').floatbe('HICorrenteFaseB21').floatbe('HICorrenteFaseB22').floatbe('HICorrenteFaseB23').floatbe('HICorrenteFaseB24').floatbe('HICorrenteFaseB25').floatbe('HICorrenteFaseB26').floatbe('HICorrenteFaseB27').floatbe('HICorrenteFaseB28').floatbe('HICorrenteFaseB29').floatbe('HICorrenteFaseB30').floatbe('HICorrenteFaseB31').floatbe('HICorrenteFaseB32').floatbe('HICorrenteFaseB33').floatbe('HICorrenteFaseB34').floatbe('HICorrenteFaseB35').floatbe('HICorrenteFaseB36').floatbe('HICorrenteFaseB37').floatbe('HICorrenteFaseB38').floatbe('HICorrenteFaseB39').floatbe('HICorrenteFaseB40').floatbe('HICorrenteFaseB41').floatbe('HICorrenteFaseB42').floatbe('HICorrenteFaseB43').floatbe('HICorrenteFaseB44').floatbe('HICorrenteFaseB45').floatbe('HICorrenteFaseB46').floatbe('HICorrenteFaseB47').floatbe('HICorrenteFaseB48').floatbe('HICorrenteFaseB49').floatbe('HTCorrenteFaseB'),

    //Harmônico Individual de Corrente C
    "FC" : new Parser().uint8("Aplicacao").floatbe('HICorrenteFaseC1').floatbe('HICorrenteFaseC2').floatbe('HICorrenteFaseC3').floatbe('HICorrenteFaseC4').floatbe('HICorrenteFaseC5').floatbe('HICorrenteFaseC6').floatbe('HICorrenteFaseC7').floatbe('HICorrenteFaseC8').floatbe('HICorrenteFaseC9').floatbe('HICorrenteFaseC10').floatbe('HICorrenteFaseC11').floatbe('HICorrenteFaseC12').floatbe('HICorrenteFaseC13').floatbe('HICorrenteFaseC14').floatbe('HICorrenteFaseC15').floatbe('HICorrenteFaseC16').floatbe('HICorrenteFaseC17').floatbe('HICorrenteFaseC18').floatbe('HICorrenteFaseC19').floatbe('HICorrenteFaseC20').floatbe('HICorrenteFaseC21').floatbe('HICorrenteFaseC22').floatbe('HICorrenteFaseC23').floatbe('HICorrenteFaseC24').floatbe('HICorrenteFaseC25').floatbe('HICorrenteFaseC26').floatbe('HICorrenteFaseC27').floatbe('HICorrenteFaseC28').floatbe('HICorrenteFaseC29').floatbe('HICorrenteFaseC30').floatbe('HICorrenteFaseC31').floatbe('HICorrenteFaseC32').floatbe('HICorrenteFaseC33').floatbe('HICorrenteFaseC34').floatbe('HICorrenteFaseC35').floatbe('HICorrenteFaseC36').floatbe('HICorrenteFaseC37').floatbe('HICorrenteFaseC38').floatbe('HICorrenteFaseC39').floatbe('HICorrenteFaseC40').floatbe('HICorrenteFaseC41').floatbe('HICorrenteFaseC42').floatbe('HICorrenteFaseC43').floatbe('HICorrenteFaseC44').floatbe('HICorrenteFaseC45').floatbe('HICorrenteFaseC46').floatbe('HICorrenteFaseC47').floatbe('HICorrenteFaseC48').floatbe('HICorrenteFaseC49').floatbe('HTCorrenteFaseC'),

    //Controlador de Carga (Eletroce)
    "A" : new Parser().uint8("Aplicacao").uint32be('Timestamp').floatbe('TensaoCC').floatbe('CorrenteCC').floatbe('PotenciaCC').floatbe('EnergiaFornecida').floatbe('EnergiaConsumida'),
    
    //Barco Elétrico (UACT CC)
    "B" : new Parser().uint8("Aplicacao").uint32be('Timestamp').uint16be('QuantidadePassageiros').uint16('TotalPassageirosMomento').floatbe('Latitude').floatbe('Longitude').floatbe('TemperaturaInterna').floatbe('TensaoCC').floatbe('CorrenteCC').floatbe('PotenciaCC').floatbe('EnergiaFornecida').floatbe('EnergiaConsumida')                
}


