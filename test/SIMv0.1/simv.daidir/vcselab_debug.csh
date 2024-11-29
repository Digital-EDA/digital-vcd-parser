#!/bin/csh -f

cd /home/icer/Project/ASICs/virtual_project/sync_fifo_flow/prj/SIMv0.1

#This ENV is used to avoid overriding current script in next vcselab run 
setenv SNPS_VCSELAB_SCRIPT_NO_OVERRIDE  1

/home/kumon/Synopsys/vcs/T-2022.06/linux64/bin/vcselab $* \
    -o \
    simv \
    -nobanner \

cd -

