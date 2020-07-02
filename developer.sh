docker build -f contextManager.docker -f orchestrator.docker -t luissajunior/flow .
sudo kubectl scale deployment flowbroker --replicas=0 -n dojot
sudo kubectl scale deployment flowbroker --replicas=1 -n dojot

sleep 7

getStatusRunningPod=$(sudo kubectl get pod -n dojot | grep -Eo '^flowbroker.*(Running)')
imprimir='.'

echo $imprimir
echo $getStatusRunningPod;

printf 'Up';
while [ -z "$getStatusRunningPod" ]
do
#  $imprimir=$imprimir'.'
  echo -ne $imprimir
  sleep 1
  getStatusRunningPod=$(sudo kubectl get pod -n dojot | grep -Eo '^flowbroker.*(Running)')
done

getNamePod=$(sudo kubectl get pod -n dojot | grep -Eo '^flow[^ ]+')

sudo kubectl port-forward $getNamePod 9229 -n dojot

